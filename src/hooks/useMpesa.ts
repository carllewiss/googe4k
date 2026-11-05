import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MpesaSource = "invoice" | "shop" | "wifi";

export interface MpesaEntry {
  id: string;
  source: MpesaSource;
  date: string;
  amount: number;
  mpesa_code: string | null;
  party: string | null;
  phone: string | null;
  reference: string | null;
}

/**
 * Unified M-Pesa reconciliation feed.
 * Pulls every M-Pesa inflow across the whole system:
 *  - ERP invoice payments (payments.mpesa_amount)
 *  - Customer store orders (shop_orders paid via M-Pesa)
 *  - WiFi / captive-portal payments (wifi_transactions)
 * Sorted newest first.
 */
export function useMpesaPayments() {
  return useQuery({
    queryKey: ["mpesa-reconciliation"],
    queryFn: async (): Promise<MpesaEntry[]> => {
      const [payRes, shopRes, wifiRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, amount, mpesa_amount, payment_date, notes, customers(name, phone)")
          .neq("mpesa_amount", 0)
          .order("payment_date", { ascending: false }),
        supabase
          .from("shop_orders")
          .select("id, total, mpesa_receipt, mpesa_phone, customer_name, customer_phone, order_number, created_at, status")
          .eq("status", "paid")
          .order("created_at", { ascending: false }),
        supabase
          .from("wifi_transactions")
          .select("id, amount, mpesa_receipt, phone_number, package_type, paid_at, status")
          .eq("status", "success")
          .order("paid_at", { ascending: false }),
      ]);

      if (payRes.error) throw payRes.error;
      if (shopRes.error) throw shopRes.error;
      if (wifiRes.error) throw wifiRes.error;

      const entries: MpesaEntry[] = [];

      for (const p of payRes.data || []) {
        const cust: any = (p as any).customers;
        entries.push({
          id: `pay-${p.id}`,
          source: "invoice",
          date: (p as any).payment_date,
          amount: Number((p as any).mpesa_amount) || 0,
          mpesa_code: extractCode((p as any).notes),
          party: cust?.name ?? "Walk-in",
          phone: cust?.phone ?? null,
          reference: (p as any).notes ?? "Invoice payment",
        });
      }

      for (const o of shopRes.data || []) {
        entries.push({
          id: `shop-${(o as any).id}`,
          source: "shop",
          date: (o as any).created_at,
          amount: Number((o as any).total) || 0,
          mpesa_code: (o as any).mpesa_receipt ?? null,
          party: (o as any).customer_name ?? null,
          phone: (o as any).mpesa_phone ?? (o as any).customer_phone ?? null,
          reference: (o as any).order_number ?? "Store order",
        });
      }

      for (const w of wifiRes.data || []) {
        entries.push({
          id: `wifi-${(w as any).id}`,
          source: "wifi",
          date: (w as any).paid_at,
          amount: Number((w as any).amount) || 0,
          mpesa_code: (w as any).mpesa_receipt ?? null,
          party: (w as any).package_type ? `WiFi · ${(w as any).package_type}` : "WiFi",
          phone: (w as any).phone_number ?? null,
          reference: (w as any).package_type ?? "WiFi voucher",
        });
      }

      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries;
    },
  });
}

// Pulls an M-Pesa confirmation code (e.g. "QK12ABCD34") out of a free-text note.
function extractCode(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/\b([A-Z0-9]{10})\b/);
  return m ? m[1] : null;
}
