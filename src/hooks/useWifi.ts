import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// POS service products that represent WiFi packages sold manually at the counter
export const POS_WIFI_PRODUCTS: Record<string, string> = {
  "cc30b27d-1df8-40f5-a567-9333cd8f91e1": "2hour",
  "729ea5dd-d15c-4199-b621-c7790fffc3f5": "24hour",
};

export interface WifiTransaction {
  id: string;
  remote_id: string;
  phone_number: string | null;
  amount: number;
  package_type: string | null;
  mpesa_receipt: string | null;
  voucher_code: string | null;
  status: string;
  paid_at: string;
  authenticated_at: string | null;
  client_mac: string | null;
  ssid: string | null;
  source?: "portal" | "pos";
  reference?: string | null;
}

export interface WifiVoucher {
  id: string;
  remote_id: string;
  code: string | null;
  package_type: string | null;
  duration_hours: number | null;
  status: string | null;
  used_by_mac: string | null;
  used_at: string | null;
}

export function useWifiTransactions() {
  return useQuery({
    queryKey: ["wifi_transactions"],
    queryFn: async () => {
      const [{ data, error }, posRes] = await Promise.all([
        supabase.from("wifi_transactions").select("*").order("paid_at", { ascending: false }),
        supabase
          .from("invoice_items")
          .select(
            "id, product_id, quantity, total, created_at, invoices(invoice_number, walkin_phone, customers(name, phone))"
          )
          .in("product_id", Object.keys(POS_WIFI_PRODUCTS))
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (posRes.error) throw posRes.error;

      const portal = (data || []) as WifiTransaction[];
      const pos: WifiTransaction[] = (posRes.data || []).map((it: any) => ({
        id: `pos-${it.id}`,
        remote_id: it.id,
        phone_number: it.invoices?.walkin_phone || it.invoices?.customers?.phone || null,
        amount: Number(it.total),
        package_type: POS_WIFI_PRODUCTS[it.product_id] || null,
        mpesa_receipt: null,
        voucher_code: null,
        status: "success",
        paid_at: it.created_at,
        authenticated_at: null,
        client_mac: null,
        ssid: null,
        source: "pos" as const,
        reference: it.invoices?.invoice_number || null,
      }));

      return [...portal.map((t) => ({ ...t, source: "portal" as const })), ...pos].sort(
        (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
      );
    },
  });
}


export function useWifiVouchers() {
  return useQuery({
    queryKey: ["wifi_vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wifi_vouchers")
        .select("*")
        .order("used_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WifiVoucher[];
    },
  });
}

/** Live WiFi feed: realtime updates + silent background sync while open. */
export function useWifiLive(intervalMs = 20000) {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["wifi_transactions"] });
      qc.invalidateQueries({ queryKey: ["wifi_vouchers"] });
    };
    const channel = supabase
      .channel("wifi-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wifi_transactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "wifi_vouchers" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "invoice_items" }, refresh)
      .subscribe();
    let busy = false;
    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const { data } = await supabase.functions.invoke("sync-wifi-payments");
        if (data?.newPayments || data?.syncedVouchers) refresh();
      } catch { /* silent */ } finally { busy = false; }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { clearInterval(id); supabase.removeChannel(channel); };
  }, [qc, intervalMs]);
}

export function useSyncWifi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-wifi-payments");
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Sync failed");
      return data as { newPayments: number; totalPaymentsSeen: number; syncedVouchers: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wifi_transactions"] });
      qc.invalidateQueries({ queryKey: ["wifi_vouchers"] });
      toast({
        title: "WiFi sync complete",
        description: `${data.newPayments} new payment${data.newPayments === 1 ? "" : "s"} pulled · ${data.syncedVouchers} vouchers updated.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Sync failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });
}
