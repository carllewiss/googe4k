SET statement_timeout = 0;

CREATE INDEX IF NOT EXISTS idx_jl_acct_date ON public.journal_lines (account_id, entry_date) INCLUDE (debit, credit);

CREATE OR REPLACE FUNCTION public.jl_set_entry_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_date IS NULL THEN
    SELECT entry_date INTO NEW.entry_date FROM public.journal_entries WHERE id = NEW.journal_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jl_entry_date ON public.journal_lines;
CREATE TRIGGER trg_jl_entry_date
  BEFORE INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.jl_set_entry_date();

CREATE OR REPLACE FUNCTION public.gl_financials(p_from date, p_to date)
 RETURNS TABLE(code text, name text, type text, period_debit numeric, period_credit numeric, asof_debit numeric, asof_credit numeric, opening_debit numeric, opening_credit numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.code,
    a.name,
    a.type::text,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date BETWEEN p_from AND p_to), 0) AS period_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date BETWEEN p_from AND p_to), 0) AS period_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date <= p_to), 0) AS asof_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date <= p_to), 0) AS asof_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date < p_from), 0) AS opening_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date < p_from), 0) AS opening_credit
  FROM public.accounts a
  LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
  GROUP BY a.code, a.name, a.type
  ORDER BY a.code;
$function$;

ALTER FUNCTION public.gl_financials(date, date) SET statement_timeout = '55s';