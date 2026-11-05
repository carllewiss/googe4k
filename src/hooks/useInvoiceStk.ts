import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StkTransaction {
  id: string;
  invoice_id: string | null;
  customer_id: string | null;
  phone: string;
  amount: number;
  status: "pending" | "success" | "failed";
  mpesa_receipt_number: string | null;
  result_desc: string | null;
  created_at: string;
  paid_at: string | null;
}

export function useInitiateStk() {
  return useMutation({
    mutationFn: async (p: {
      invoice_id?: string | null;
      customer_id?: string | null;
      phone: string;
      amount: number;
      created_by?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("invoice-stk-push", { body: p });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { transaction_id: string; mode: "live" | "test" };
    },
  });
}

/** Polls a single STK transaction until it settles (success/failed). */
export function useStkStatus(transactionId: string | null) {
  return useQuery({
    queryKey: ["mpesa-tx", transactionId],
    enabled: !!transactionId,
    refetchInterval: (query) => {
      const status = (query.state.data as StkTransaction | undefined)?.status;
      return status === "pending" || status === undefined ? 3000 : false;
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mpesa_transactions")
        .select("*")
        .eq("id", transactionId)
        .single();
      if (error) throw error;
      return data as StkTransaction;
    },
  });
}

/** Latest STK transaction per invoice (used to show status badges in the list). */
export function useInvoiceStkTransactions() {
  return useQuery({
    queryKey: ["mpesa-tx-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mpesa_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as StkTransaction[];
    },
  });
}

export function useInvalidateStk() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["mpesa-tx-all"] });
  };
}
