import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupplierStats = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  kra_pin: string | null;
  created_at: string;
  purchase_count: number;
  total_purchased: number;
  total_paid: number;
  outstanding: number;
  overdue: number;
  last_purchase_date: string | null;
};

/** Suppliers enriched with purchase / payment totals and overdue exposure. */
export function useSuppliersWithStats() {
  return useQuery({
    queryKey: ["suppliers-with-stats"],
    queryFn: async (): Promise<SupplierStats[]> => {
      const [{ data: sups, error: sErr }, { data: purchases, error: pErr }] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        (supabase as any)
          .from("purchases")
          .select("supplier_id, total, amount_paid, status, due_date, invoice_date, purchase_date"),
      ]);
      if (sErr) throw sErr;
      if (pErr) throw pErr;

      const now = new Date();
      const agg: Record<string, any> = {};
      (purchases || []).forEach((p: any) => {
        if (p.status !== "posted") return;
        const a = (agg[p.supplier_id] ||= {
          purchase_count: 0, total_purchased: 0, total_paid: 0, outstanding: 0, overdue: 0, last: null as string | null,
        });
        const total = Number(p.total || 0);
        const paid = Number(p.amount_paid || 0);
        a.purchase_count += 1;
        a.total_purchased += total;
        a.total_paid += paid;
        const bal = Math.max(total - paid, 0);
        a.outstanding += bal;
        if (bal > 0.01 && p.due_date && new Date(p.due_date) < now) a.overdue += bal;
        const d = p.invoice_date || p.purchase_date;
        if (d && (!a.last || d > a.last)) a.last = d;
      });

      return (sups || []).map((s: any) => {
        const a = agg[s.id] || {};
        return {
          ...s,
          purchase_count: a.purchase_count || 0,
          total_purchased: a.total_purchased || 0,
          total_paid: a.total_paid || 0,
          outstanding: a.outstanding || 0,
          overdue: a.overdue || 0,
          last_purchase_date: a.last || null,
        };
      });
    },
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSupplierPurchases(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier-purchases", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchases")
        .select("*, purchase_items(id, line_type, description, quantity, unit_cost, total, products(name))")
        .eq("supplier_id", id!)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSupplierPayments(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier-payments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("supplier_payments")
        .select("*, supplier_payment_allocations(amount, purchase_id)")
        .eq("supplier_id", id!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

/** Items ever bought from a supplier, with last cost. */
export function useSupplierProducts(id: string | undefined) {
  return useQuery({
    queryKey: ["supplier-products", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_batches")
        .select("product_id, quantity_bought, cost_price, purchase_date, products(name, unit)")
        .eq("supplier_id", id!)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((b: any) => {
        const k = b.product_id;
        map[k] ||= { product_id: k, name: b.products?.name || "—", unit: b.products?.unit || "", qty: 0, last_cost: Number(b.cost_price), last_date: b.purchase_date, spend: 0 };
        map[k].qty += Number(b.quantity_bought || 0);
        map[k].spend += Number(b.quantity_bought || 0) * Number(b.cost_price || 0);
      });
      return Object.values(map).sort((a: any, b: any) => b.spend - a.spend) as any[];
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { id: string; name: string; phone?: string | null; email?: string | null; kra_pin?: string | null }) => {
      const { id, ...rest } = s;
      const { error } = await supabase.from("suppliers").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["suppliers-with-stats"] });
      qc.invalidateQueries({ queryKey: ["supplier"] });
    },
  });
}
