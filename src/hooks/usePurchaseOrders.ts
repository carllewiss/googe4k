import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type POLine = {
  product_id: string | null;
  description?: string;
  quantity: number;
  unit_cost: number;
  vat_rate: number; // %
};

export function usePurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ["purchase-orders", status ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("purchase_orders")
        .select("*, suppliers(name, kra_pin), purchase_order_items(*, products(name))")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

function totals(items: POLine[]) {
  let subtotal = 0, vat_total = 0;
  for (const it of items) {
    const lineNet = it.quantity * it.unit_cost;
    const v = lineNet * (it.vat_rate || 0) / 100;
    subtotal += lineNet;
    vat_total += v;
  }
  return { subtotal, vat_total, total: subtotal + vat_total };
}

export function useSavePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      supplier_id: string;
      order_date: string;
      expected_date?: string | null;
      reference?: string;
      notes?: string;
      status: "draft" | "issued";
      items: POLine[];
    }) => {
      const t = totals(params.items);
      let id = params.id;
      if (id) {
        const { error } = await (supabase as any).from("purchase_orders").update({
          supplier_id: params.supplier_id, order_date: params.order_date, expected_date: params.expected_date,
          reference: params.reference, notes: params.notes, status: params.status, ...t,
        }).eq("id", id);
        if (error) throw error;
        await (supabase as any).from("purchase_order_items").delete().eq("po_id", id);
      } else {
        const { data, error } = await (supabase as any).from("purchase_orders").insert({
          supplier_id: params.supplier_id, order_date: params.order_date, expected_date: params.expected_date,
          reference: params.reference, notes: params.notes, status: params.status, ...t,
        }).select().single();
        if (error) throw error;
        id = data.id;
      }
      const rows = params.items.map(it => {
        const lineNet = it.quantity * it.unit_cost;
        const v = lineNet * (it.vat_rate || 0) / 100;
        return {
          po_id: id, product_id: it.product_id, description: it.description ?? null,
          quantity: it.quantity, unit_cost: it.unit_cost, vat_rate: it.vat_rate,
          vat_amount: v, line_total: lineNet + v,
        };
      });
      if (rows.length) {
        const { error } = await (supabase as any).from("purchase_order_items").insert(rows);
        if (error) throw error;
      }
      return id!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useConvertPOToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (po_id: string) => {
      const { data, error } = await (supabase as any).rpc("convert_po_to_invoice", { p_po_id: po_id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useCancelPO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}
