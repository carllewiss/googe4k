import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RefundMethod = "none" | "credit_balance" | "cash_refund" | "mpesa_refund";

export function useCreditNotes() {
  return useQuery({
    queryKey: ["credit-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("*, customers(name, customer_code), invoices(invoice_number), credit_note_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreditNote(id: string | undefined) {
  return useQuery({
    queryKey: ["credit-note", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_notes")
        .select("*, customers(name, customer_code, kra_pin), invoices(invoice_number), credit_note_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreditNotesForProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ["credit-notes-for-product", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_note_items")
        .select("id, quantity, unit_price, created_at, restored_to_stock, credit_notes!inner(credit_note_number, created_at, customers(name, customer_code))")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      invoice_id: string;
      reason: string;
      refund_method: RefundMethod;
      items: { invoice_item_id: string; quantity: number }[];
    }) => {
      const { data, error } = await supabase.rpc("create_credit_note", {
        p_invoice_id: params.invoice_id,
        p_reason: params.reason,
        p_refund_method: params.refund_method,
        p_items: params.items as any,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["product-movements"] });
    },
  });
}

export function useReprintCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("mark_credit_note_reprint", { p_id: id });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-notes"] }),
  });
}
