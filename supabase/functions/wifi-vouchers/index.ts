// Manage WiFi captive-portal vouchers from the ERP.
// Lists vouchers (used + unused) with server-side pagination and uploads new
// voucher codes (from an Excel/CSV template) into the separate Omada captive-
// portal Supabase project (tyqcalkdvsmeczbbqfns) via its anon REST API.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PORTAL_URL = "https://tyqcalkdvsmeczbbqfns.supabase.co";
const PORTAL_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWNhbGtkdnNtZWN6YmJxZm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDUxNTYsImV4cCI6MjA4NjMyMTE1Nn0.VTgZPClT7Te2R-9Y6zvtVyDj6pVWRvX7svvvLSx3fcw";

const portalHeaders = {
  apikey: PORTAL_ANON,
  Authorization: `Bearer ${PORTAL_ANON}`,
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    // ---------------- LIST (paginated) ----------------
    if (action === "list") {
      const page = Math.max(1, Number(body.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(body.pageSize) || 25));
      const status = body.status ?? "all"; // all | used | unused
      const search = (body.search ?? "").trim();

      // Sort by most recently used first (used_at desc), unused vouchers last.
      let query =
        "vouchers?select=id,code,package_type,duration_hours,status,is_used,used_by_mac,used_at,created_at&order=used_at.desc.nullslast,created_at.desc";
      if (status === "used") query += "&is_used=eq.true";
      else if (status === "unused") query += "&is_used=eq.false";
      if (search) query += `&code=ilike.*${encodeURIComponent(search)}*`;

      const offset = (page - 1) * pageSize;
      const res = await fetch(`${PORTAL_URL}/rest/v1/${query}`, {
        headers: {
          ...portalHeaders,
          Prefer: "count=exact",
          Range: `${offset}-${offset + pageSize - 1}`,
        },
      });
      if (!res.ok) throw new Error(`Portal list failed (${res.status}): ${await res.text()}`);
      const rows = await res.json();
      const contentRange = res.headers.get("content-range") || "";
      const total = Number(contentRange.split("/")[1]) || rows.length;

      // Totals for stat cards (cheap HEAD-style count requests)
      const counts = await Promise.all(
        ["", "&is_used=eq.true", "&is_used=eq.false"].map(async (f) => {
          const r = await fetch(`${PORTAL_URL}/rest/v1/vouchers?select=id${f}`, {
            headers: { ...portalHeaders, Prefer: "count=exact", Range: "0-0" },
          });
          const cr = r.headers.get("content-range") || "";
          return Number(cr.split("/")[1]) || 0;
        }),
      );

      return json({
        rows,
        total,
        page,
        pageSize,
        totals: { all: counts[0], used: counts[1], unused: counts[2] },
      });
    }

    // ---------------- UPLOAD ----------------
    if (action === "upload") {
      const incoming: any[] = Array.isArray(body.vouchers) ? body.vouchers : [];
      const clean = incoming
        .map((v) => {
          const code = String(v.code ?? "").trim();
          let pkg = String(v.package_type ?? "2hour").trim().toLowerCase();
          if (pkg !== "24hour" && pkg !== "2hour") pkg = pkg.includes("24") ? "24hour" : "2hour";
          let dur = parseInt(String(v.duration_hours ?? ""), 10);
          if (isNaN(dur)) dur = pkg === "24hour" ? 24 : 2;
          return code ? { code, package_type: pkg, duration_hours: dur, status: "unused", is_used: false } : null;
        })
        .filter(Boolean) as any[];

      if (clean.length === 0) return json({ error: "No valid voucher codes found." }, 400);

      // De-dupe against existing codes
      const codes = clean.map((c) => c.code);
      const existRes = await fetch(
        `${PORTAL_URL}/rest/v1/vouchers?select=code&code=in.(${codes
          .map((c) => `"${c.replace(/"/g, "")}"`)
          .join(",")})`,
        { headers: portalHeaders },
      );
      const existing: { code: string }[] = existRes.ok ? await existRes.json() : [];
      const existingSet = new Set(existing.map((e) => e.code));
      const toInsert = clean.filter((c) => !existingSet.has(c.code));
      const skipped = clean.length - toInsert.length;

      let inserted = 0;
      if (toInsert.length) {
        const ins = await fetch(`${PORTAL_URL}/rest/v1/vouchers`, {
          method: "POST",
          headers: { ...portalHeaders, Prefer: "return=representation" },
          body: JSON.stringify(toInsert),
        });
        if (!ins.ok) throw new Error(`Portal insert failed (${ins.status}): ${await ins.text()}`);
        const data = await ins.json();
        inserted = Array.isArray(data) ? data.length : 0;
      }

      return json({ success: true, inserted, skipped, received: clean.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("wifi-vouchers error:", e);
    return json({ success: false, error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
