-- 1. New expense fields for the rebuilt module
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_no text,
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- 2. Auto-numbering: EXP000001 ...
CREATE SEQUENCE IF NOT EXISTS public.expense_no_seq START 1;

CREATE OR REPLACE FUNCTION public.set_expense_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expense_no IS NULL OR NEW.expense_no = '' THEN
    NEW.expense_no := 'EXP' || lpad(nextval('public.expense_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_expense_no ON public.expenses;
CREATE TRIGGER trg_set_expense_no
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_no();

-- Backfill existing rows
UPDATE public.expenses
SET expense_no = 'EXP' || lpad(nextval('public.expense_no_seq')::text, 6, '0')
WHERE expense_no IS NULL OR expense_no = '';

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_no_key;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_no_key UNIQUE (expense_no);

-- 3. Reverse (delete) an expense: post a contra journal, then remove the row.
-- Keeps the General Ledger correct because original journals are immutable.
CREATE OR REPLACE FUNCTION public.reverse_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je uuid;
  v_lines jsonb;
  v_no text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reverse expenses';
  END IF;

  SELECT journal_id, expense_no INTO v_je, v_no FROM public.expenses WHERE id = p_expense_id;

  IF v_je IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('account', a.code, 'debit', jl.credit, 'credit', jl.debit))
      INTO v_lines
      FROM public.journal_lines jl
      JOIN public.accounts a ON a.id = jl.account_id
     WHERE jl.journal_id = v_je;

    IF v_lines IS NOT NULL THEN
      PERFORM public.post_journal(
        'expense_reversal', p_expense_id,
        'Reversal of expense ' || COALESCE(v_no, ''),
        v_lines, CURRENT_DATE);
    END IF;
  END IF;

  DELETE FROM public.expenses WHERE id = p_expense_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.reverse_expense(uuid) TO authenticated;

-- 4. Ensure admins can fully manage the chart of accounts via the Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;