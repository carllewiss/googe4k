CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON public.journal_entries (entry_date);

CREATE OR REPLACE FUNCTION public.gl_financials(p_from date, p_to date)
RETURNS TABLE (
  code text,
  name text,
  type text,
  period_debit numeric,
  period_credit numeric,
  asof_debit numeric,
  asof_credit numeric,
  opening_debit numeric,
  opening_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.code,
    a.name,
    a.type::text,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date BETWEEN p_from AND p_to), 0) AS period_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date BETWEEN p_from AND p_to), 0) AS period_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date <= p_to), 0) AS asof_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date <= p_to), 0) AS asof_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date < p_from), 0) AS opening_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date < p_from), 0) AS opening_credit
  FROM public.accounts a
  LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_id
  GROUP BY a.code, a.name, a.type
  ORDER BY a.code;
$$;

GRANT EXECUTE ON FUNCTION public.gl_financials(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gl_financials(date, date) TO service_role;