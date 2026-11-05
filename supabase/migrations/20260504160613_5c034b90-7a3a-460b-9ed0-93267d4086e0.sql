
DROP VIEW IF EXISTS public.v_trial_balance;
CREATE VIEW public.v_trial_balance
WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.code, a.name, a.type,
  COALESCE(SUM(jl.debit),0) AS total_debit,
  COALESCE(SUM(jl.credit),0) AS total_credit,
  COALESCE(SUM(jl.debit - jl.credit),0) AS balance
FROM public.accounts a
LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;

REVOKE EXECUTE ON FUNCTION public.post_journal(text,uuid,text,jsonb,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_credit_note_journal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.map_expense_category_to_account(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.invoice_net(numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_journal(text,uuid,text,jsonb,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_credit_note_journal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_expense_category_to_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_net(numeric,numeric,numeric) TO authenticated;
