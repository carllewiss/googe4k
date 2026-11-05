import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductPurchaseInfo = {
  id: string;
  name: string;
  category: string;
  unit: string;
  is_service: boolean;
  tax_category: string;
  vat_rate: number | null;
  stock_on_hand: number;
  last_cost: number | null;
  last_supplier: string | null;
  last_purchase_date: string | null;
  last_qty: number | null;
};

/**
 * Products enriched with stock on hand + last purchase info (cost, supplier, date)
 * derived from FIFO stock batches. Powers the intelligent purchasing autocomplete.
 */
export function useProductsPurchaseView() {
  return useQuery({
    queryKey: ["products-purchase-view"],
    queryFn: async (): Promise<ProductPurchaseInfo[]> => {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, category, unit, is_service, tax_category, vat_rate")
        .order("name");
      if (error) throw error;

      const { data: batches, error: bErr } = await supabase
        .from("stock_batches")
        .select("product_id, quantity_bought, quantity_remaining, cost_price, purchase_date, created_at, suppliers(name)")
        .order("created_at", { ascending: false });
      if (bErr) throw bErr;

      const stockMap: Record<string, number> = {};
      const lastMap: Record<string, any> = {};
      (batches || []).forEach((b: any) => {
        stockMap[b.product_id] = (stockMap[b.product_id] || 0) + (b.quantity_remaining || 0);
        if (!lastMap[b.product_id]) lastMap[b.product_id] = b; // first = latest (ordered desc)
      });

      return (products || []).map((p: any) => {
        const last = lastMap[p.id];
        return {
          ...p,
          stock_on_hand: stockMap[p.id] || 0,
          last_cost: last ? Number(last.cost_price) : null,
          last_supplier: last?.suppliers?.name ?? null,
          last_purchase_date: last?.purchase_date ?? null,
          last_qty: last ? Number(last.quantity_bought) : null,
        };
      });
    },
  });
}

/**
 * Outstanding payable balance per supplier: sum of posted credit purchases.
 * (No supplier-payment ledger exists yet, so this reflects billed-on-credit totals.)
 */
export function useSupplierBalances() {
  return useQuery({
    queryKey: ["supplier-balances"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("purchases")
        .select("supplier_id, total, payment_mode, status");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.status === "posted" && p.payment_mode === "credit") {
          map[p.supplier_id] = (map[p.supplier_id] || 0) + Number(p.total || 0);
        }
      });
      return map;
    },
  });
}

/** Recent purchases from a specific supplier (for the create screen sidebar). */
export function useSupplierRecentPurchases(supplierId: string | undefined) {
  return useQuery({
    queryKey: ["supplier-recent-purchases", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, purchase_code, invoice_number, invoice_date, purchase_date, total, status, payment_mode")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as any[];
    },
  });
}

/** Stock batches created around a posted purchase (supplier + date match). */
export function usePurchaseBatches(supplierId: string | undefined, purchaseDate: string | undefined) {
  return useQuery({
    queryKey: ["purchase-batches", supplierId, purchaseDate],
    enabled: !!supplierId && !!purchaseDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_batches")
        .select("id, quantity_bought, quantity_remaining, cost_price, purchase_date, products(name)")
        .eq("supplier_id", supplierId!)
        .eq("purchase_date", purchaseDate!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

/** Purchase dashboard KPIs derived from posted purchases. */
export function usePurchaseKpis() {
  return useQuery({
    queryKey: ["purchase-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("total, vat_total, invoice_date, purchase_date, due_date, status, payment_mode");
      if (error) throw error;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let monthTotal = 0, vatClaimable = 0, outstanding = 0, overdue = 0;
      (data || []).forEach((p: any) => {
        if (p.status !== "posted") return;
        const d = new Date(p.invoice_date || p.purchase_date);
        if (d >= monthStart) { monthTotal += Number(p.total || 0); vatClaimable += Number(p.vat_total || 0); }
        if (p.payment_mode === "credit") {
          outstanding += Number(p.total || 0);
          if (p.due_date && new Date(p.due_date) < now) overdue += Number(p.total || 0);
        }
      });
      return { monthTotal, vatClaimable, outstanding, overdue };
    },
  });
}
