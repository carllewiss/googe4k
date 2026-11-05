import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = "cash" | "bank" | "mpesa" | "credit";

export interface ExpenseRow {
  id: string;
  expense_no: string | null;
  category: string;
  description: string | null;
  amount: number;
  vat_amount: number;
  reference_no: string | null;
  payment_method: PaymentMethod | null;
  expense_date: string;
  account_id: string | null;
  payment_account_id: string | null;
  supplier_id: string | null;
  attachment_url: string | null;
  status: string;
  journal_id: string | null;
  created_at: string;
  accounts?: { code: string; name: string } | null;
  suppliers?: { name: string } | null;
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("expenses")
        .select("*, accounts:account_id(code,name), suppliers:supplier_id(name)")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseRow[];
    },
  });
}

export interface NewExpenseInput {
  category: string;
  description?: string;
  amount: number; // net (excl VAT)
  vat_amount?: number;
  reference_no?: string | null;
  payment_method: PaymentMethod;
  expense_date: string;
  account_id: string | null;
  payment_account_id: string | null;
  supplier_id?: string | null;
  attachment_url?: string | null;
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: NewExpenseInput) => {
      const { data, error } = await (supabase as any)
        .from("expenses")
        .insert(expense as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      qc.invalidateQueries({ queryKey: ["gl-financials"] });
    },
  });
}

/** Reverses an expense (posts contra journal) and removes the row. Admin only. */
export function useReverseExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await (supabase as any).rpc("reverse_expense", { p_expense_id: expenseId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      qc.invalidateQueries({ queryKey: ["gl-financials"] });
    },
  });
}

/** Uploads an expense receipt to the private receipts bucket, returns the storage path. */
export async function uploadExpenseReceipt(file: File) {
  const ext = file.name.split(".").pop();
  const path = `expenses/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("purchase-receipts")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getExpenseReceiptUrl(path: string, expires = 3600) {
  const { data, error } = await supabase.storage.from("purchase-receipts").createSignedUrl(path, expires);
  if (error) throw error;
  return data.signedUrl;
}
