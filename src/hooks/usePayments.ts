import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: {
      invoice_id: string;
      customer_id: string;
      amount: number;
      cash_amount: number;
      mpesa_amount: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase.from("payments").insert(payment).select().single();
      if (error) throw error;

      // Update invoice paid_amount and balance
      const { data: inv } = await supabase.from("invoices").select("paid_amount, total").eq("id", payment.invoice_id).single();
      if (inv) {
        const newPaid = Number(inv.paid_amount) + payment.amount;
        const newBalance = Math.max(0, Number(inv.total) - newPaid);
        await supabase.from("invoices").update({
          paid_amount: newPaid,
          balance: newBalance,
          status: newBalance === 0 ? "paid" : "partial",
        }).eq("id", payment.invoice_id);
      }

      // Update customer balance
      const { data: cust } = await supabase.from("customers").select("current_balance, total_spent").eq("id", payment.customer_id).single();
      if (cust) {
        await supabase.from("customers").update({
          current_balance: Math.max(0, Number(cust.current_balance) - payment.amount),
          total_spent: Number(cust.total_spent) + payment.amount,
        }).eq("id", payment.customer_id);
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
