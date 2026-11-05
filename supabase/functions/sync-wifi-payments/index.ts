// Sync WiFi captive-portal payments + voucher assignments into the ERP.
// Pulls from BOTH portal databases (portal1 + portal2). Incremental: only
// pulls rows newer than what we already have per portal, and inserts in
// small batches so the database never hits a statement timeout.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PORTALS = [
  {
    source: "portal1",
    url: "https://tyqcalkdvsmeczbbqfns.supabase.co",
    anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWNhbGtkdnNtZWN6YmJxZm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUxNTYsImV4cCI6MjA4NjMyMTE1Nn0.VTgZPClT7Te2R-9Y6zvtVyDj6pVWRvX7svvvLSx3fcw",
  },
  {
    source: "portal2",
    url: "https://wfvzkkcpzrfmofurlftc.supabase.co",
    anon: "sb_publishable_RzKJZNMwP-WOzUvypgjYgw_K23TU6kA",
  },
];

const CHUNK = 200;

async function portalGet(portal: (typeof PORTALS)[number], path: string) {
  const res = await fetch(`${portal.url}/rest/v1/${path}`, {
    headers: { apikey: portal.anon, Authorization: `Bearer ${portal.anon}` },
  });
  if (!res.ok) {
    const body = await res.text();
    // Some portals lack optional columns (e.g. authenticated_at) — retry without them.
    const m = body.match(/column \w+\.(\w+) does not exist/);
    if (res.status === 400 && m) {
      const col = m[1];
      const reduced = path.replace(/select=([^&]*)/, (_s, list: string) =>
        "select=" + list.split(",").filter((c) => c && c !== col).join(","));
      if (reduced !== path) return portalGet(portal, reduced);
    }
    throw new Error(`Portal fetch failed (${res.status}): ${body}`);
  }
  return await res.json();
}

// Go back 2 days from the latest known row to catch late updates safely.
function since(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(new Date(ts).getTime() - 2 * 86400000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({ paused: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const erp = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const results: Record<string, { newPayments: number; totalPaymentsSeen: number; syncedVouchers: number }> = {};

    for (const portal of PORTALS) {
      // ---------- 1. Payments ----------
      const { data: lastTx } = await erp
        .from("wifi_transactions").select("paid_at").eq("source", portal.source)
        .order("paid_at", { ascending: false }).limit(1).maybeSingle();
      const txSince = since(lastTx?.paid_at);
      const txns: any[] = await portalGet(
        portal,
        "transactions?status=eq.success&select=id,phone_number,amount,package_type,mpesa_receipt,voucher_code,status,created_at,authenticated_at,client_mac,ssid&order=created_at.asc" +
          (txSince ? `&created_at=gte.${encodeURIComponent(txSince)}` : ""),
      );

      let newPayments = 0;
      if (txns.length) {
        // Find which ones already exist so we only insert genuinely new rows.
        const existing = new Set<string>();
        const ids = txns.map((t) => t.id);
        for (let i = 0; i < ids.length; i += CHUNK) {
          const { data, error } = await erp.from("wifi_transactions").select("remote_id").in("remote_id", ids.slice(i, i + CHUNK));
          if (error) throw error;
          data?.forEach((r: any) => existing.add(r.remote_id));
        }
        const rows = txns.filter((t) => !existing.has(t.id)).map((t) => ({
          remote_id: t.id,
          phone_number: t.phone_number,
          amount: Number(t.amount) || 0,
          package_type: t.package_type,
          mpesa_receipt: t.mpesa_receipt,
          voucher_code: t.voucher_code,
          status: t.status,
          paid_at: t.created_at,
          authenticated_at: t.authenticated_at,
          client_mac: t.client_mac,
          ssid: t.ssid,
          source: portal.source,
        }));
        for (let i = 0; i < rows.length; i += 50) {
          const { data, error } = await erp
            .from("wifi_transactions")
            .upsert(rows.slice(i, i + 50), { onConflict: "remote_id", ignoreDuplicates: true })
            .select("id");
          if (error) throw error;
          newPayments += data?.length ?? 0;
        }
      }

      // ---------- 2. Used vouchers ----------
      const { data: lastV } = await erp
        .from("wifi_vouchers").select("used_at").eq("source", portal.source)
        .not("used_at", "is", null).order("used_at", { ascending: false }).limit(1).maybeSingle();
      const vSince = since(lastV?.used_at);
      const vouchers: any[] = await portalGet(
        portal,
        "vouchers?is_used=eq.true&select=id,code,package_type,duration_hours,status,used_by_mac,used_at&order=used_at.asc" +
          (vSince ? `&used_at=gte.${encodeURIComponent(vSince)}` : ""),
      );

      let syncedVouchers = 0;
      for (let i = 0; i < vouchers.length; i += CHUNK) {
        const rows = vouchers.slice(i, i + CHUNK).map((v) => ({
          remote_id: v.id,
          code: v.code,
          package_type: v.package_type,
          duration_hours: v.duration_hours,
          status: v.status,
          used_by_mac: v.used_by_mac,
          used_at: v.used_at,
          source: portal.source,
        }));
        const { error } = await erp.from("wifi_vouchers").upsert(rows, { onConflict: "remote_id" });
        if (error) throw error;
        syncedVouchers += rows.length;
      }

      results[portal.source] = { newPayments, totalPaymentsSeen: txns.length, syncedVouchers };
    }

    const totals = Object.values(results).reduce(
      (a, r) => ({ newPayments: a.newPayments + r.newPayments, syncedVouchers: a.syncedVouchers + r.syncedVouchers }),
      { newPayments: 0, syncedVouchers: 0 },
    );

    return new Response(
      JSON.stringify({ success: true, ...totals, byPortal: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-wifi-payments error:", e);
    return new Response(
      JSON.stringify({ success: false, error: String((e as any)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
