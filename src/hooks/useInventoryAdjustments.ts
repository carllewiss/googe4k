import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AdjustmentType = Database["public"]["Enums"]["adjustment_type"];

export type AdjustmentLine = {
  product_id: string;
  quantity: number;
  unit_cost?: number;
  notes?: string | null;
};

export const ADJUSTMENT_TYPES: {
  value: AdjustmentType;
  label: string;
  direction: "decrease" | "increase" | "either" | "none";
  hint: string;
}[] = [
  { value: "damaged", label: "Damaged goods", direction: "decrease", hint: "Dr Inventory Loss / Cr Inventory" },
  { value: "expired", label: "Expired items", direction: "decrease", hint: "Dr Expired Stock / Cr Inventory" },
  { value: "lost", label: "Lost / missing", direction: "decrease", hint: "Dr Shrinkage / Cr Inventory" },
  { value: "theft", label: "Theft", direction: "decrease", hint: "Dr Theft Expense / Cr Inventory" },
  { value: "promotional", label: "Promotional giveaway", direction: "decrease", hint: "Dr Marketing / Cr Inventory" },
  { value: "internal_use", label: "Internal use", direction: "decrease", hint: "Dr Office Supplies / Cr Inventory" },
  { value: "supplier_replacement", label: "Supplier replacement", direction: "increase", hint: "Dr Inventory / Cr Supplier Claims" },
  { value: "found", label: "Stock found", direction: "increase", hint: "Dr Inventory / Cr Inventory Gain" },
  { value: "opening_correction", label: "Opening balance correction", direction: "either", hint: "Opening Balance Equity" },
  { value: "data_correction", label: "Barcode / data correction", direction: "none", hint: "Audit only — no quantity change" },
  { value: "repackaging", label: "Repackaging / unit conversion", direction: "either", hint: "Internal movement, no P&L" },
];

/** Products with on-hand quantity, FIFO next-layer cost and weighted average cost */
export function useStockCosts() {
  return useQuery({
    queryKey: ["stock-costs"],
    queryFn: async () => {
      const [{ data: products, error: pErr }, { data: batches, error: bErr }] = await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase
          .from("stock_batches")
          .select("product_id, quantity_remaining, cost_price, purchase_date, created_at")
          .order("purchase_date", { ascending: true }),
      ]);
      if (pErr) throw pErr;
      if (bErr) throw bErr;

      const map: Record<string, { qty: number; value: number; fifo: number | null; last: number | null }> = {};
      (batches || []).forEach((b: any) => {
        const e = (map[b.product_id] ||= { qty: 0, value: 0, fifo: null, last: null });
        const rem = Number(b.quantity_remaining) || 0;
        const cost = Number(b.cost_price) || 0;
        if (rem > 0) {
          e.qty += rem;
          e.value += rem * cost;
          if (e.fifo === null) e.fifo = cost;
        }
        e.last = cost;
      });

      return (products || []).map((p: any) => {
        const e = map[p.id];
        return {
          ...p,
          stock_on_hand: e?.qty || 0,
          fifo_cost: e?.fifo ?? e?.last ?? 0,
          avg_cost: e && e.qty > 0 ? e.value / e.qty : (e?.last ?? 0),
          stock_value: e?.value || 0,
        };
      });
    },
  });
}

export function useAdjustments() {
  return useQuery({
    queryKey: ["inventory-adjustments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("*, inventory_adjustment_items(id, product_id, quantity, unit_cost, value, notes, products(name, unit))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAdjustmentAttachments(adjustmentId?: string) {
  return useQuery({
    queryKey: ["adjustment-attachments", adjustmentId],
    enabled: !!adjustmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_adjustment_attachments")
        .select("*")
        .eq("adjustment_id", adjustmentId!)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export async function getEvidenceUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("adjustment-evidence")
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export function usePostAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      reason,
      notes,
      date,
      warehouse,
      items,
      files,
    }: {
      type: AdjustmentType;
      reason: string;
      notes?: string | null;
      date: string;
      warehouse?: string;
      items: AdjustmentLine[];
      files?: File[];
    }) => {
      const { data: id, error } = await supabase.rpc("post_inventory_adjustment", {
        p_type: type,
        p_reason: reason,
        p_notes: notes ?? null,
        p_items: items as any,
        p_date: date,
        p_warehouse: warehouse || "Kakamega Main Store",
      });
      if (error) throw error;

      const adjustmentId = id as string;
      const failed: string[] = [];
      for (const file of files || []) {
        const path = `${adjustmentId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("adjustment-evidence")
          .upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (upErr) {
          failed.push(file.name);
          continue;
        }
        const { error: rowErr } = await supabase.from("inventory_adjustment_attachments").insert({
          adjustment_id: adjustmentId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_size: file.size,
        });
        if (rowErr) failed.push(file.name);
      }

      return { id: adjustmentId, failedUploads: failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-adjustments"] });
      qc.invalidateQueries({ queryKey: ["stock-costs"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["product-batches"] });
      qc.invalidateQueries({ queryKey: ["product-movements"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}
