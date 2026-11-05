import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string | null;
  is_active?: boolean;
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { code: string; name: string; type: AccountType; parent_id?: string | null }) => {
      const { data, error } = await (supabase as any).from("accounts").insert(a).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; code?: string; name?: string; type?: AccountType; is_active?: boolean }) => {
      const { error } = await (supabase as any).from("accounts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export interface GLAgg {
  code: string;
  name: string;
  type: string; // asset | liability | equity | income | expense
  period_debit: number;
  period_credit: number;
  asof_debit: number;
  asof_credit: number;
  opening_debit: number;
  opening_credit: number;
}

/**
 * Server-side aggregated General Ledger totals per account for a date range.
 * All financial statements derive from these GL figures (never from
 * invoices/expenses tables) so adjustments, journals & accruals are included.
 */
export function useGLFinancials(from: string, to: string, opts?: { enabled?: boolean }) {
  return useQuery({
    enabled: opts?.enabled ?? true,
    queryKey: ["gl-financials", from, to],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("gl_financials", { p_from: from, p_to: to });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        period_debit: Number(r.period_debit) || 0,
        period_credit: Number(r.period_credit) || 0,
        asof_debit: Number(r.asof_debit) || 0,
        asof_credit: Number(r.asof_credit) || 0,
        opening_debit: Number(r.opening_debit) || 0,
        opening_credit: Number(r.opening_credit) || 0,
      })) as GLAgg[];
    },
    staleTime: 60_000,
  });
}



export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("accounts").select("*").order("code");
      if (error) throw error;
      return data as Array<{ id: string; code: string; name: string; type: string }>;
    },
  });
}

export function useTrialBalance() {
  return useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("v_trial_balance").select("*");
      if (error) throw error;
      return data as Array<{ account_id: string; code: string; name: string; type: string; total_debit: number; total_credit: number; balance: number }>;
    },
  });
}

export function useJournals(limit = 100) {
  return useQuery({
    queryKey: ["journals", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("journal_entries")
        .select("*, journal_lines(*, accounts(code,name))")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useAccountLedger(accountId: string | null) {
  return useQuery({
    queryKey: ["ledger", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("journal_lines")
        .select("*, journal_entries(entry_date, description, reference_type)")
        .eq("account_id", accountId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
