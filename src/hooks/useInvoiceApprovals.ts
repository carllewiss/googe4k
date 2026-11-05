import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Invoices held for admin approval (created for suspended / over-limit customers). */
export function usePendingApprovals() {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*), customers(name, current_balance, debt_limit, credit_terms)")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((inv) => ({
        ...inv,
        customer_name: (inv.customers as any)?.name || "Walk-in",
      }));
    },
  });
}

export function useApproveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ approval_status: "approved" })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/**
 * Reject a pending invoice: restore stock, reverse the customer balance,
 * then remove the invoice (items cascade).
 */
export function useRejectInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", invoiceId)
        .single();
      if (invErr) throw invErr;

      const items = (inv as any).invoice_items || [];

      // Restore stock for physical products (services have no stock)
      for (const item of items) {
        const { data: prod } = await supabase
          .from("products")
          .select("is_service")
          .eq("id", item.product_id)
          .maybeSingle();
        if (prod?.is_service) continue;
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;
        const unitCost = qty > 0 ? (Number(item.cogs) || 0) / qty : 0;
        await supabase.from("stock_batches").insert({
          product_id: item.product_id,
          quantity_bought: qty,
          quantity_remaining: qty,
          cost_price: unitCost,
          purchase_date: new Date().toISOString().slice(0, 10),
        });
      }

      // Reverse customer balance / stats
      const { data: cust } = await supabase
        .from("customers")
        .select("current_balance, total_spent, visit_count")
        .eq("id", inv.customer_id)
        .maybeSingle();
      if (cust) {
        await supabase
          .from("customers")
          .update({
            current_balance: Math.max(0, Number(cust.current_balance) - Number(inv.balance || 0)),
            total_spent: Math.max(0, Number(cust.total_spent) - Number(inv.paid_amount || 0)),
            visit_count: Math.max(0, Number(cust.visit_count) - 1),
          })
          .eq("id", inv.customer_id);
      }

      // Remove the invoice (invoice_items cascade)
      const { error: delErr } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}
