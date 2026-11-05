ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS walkin_name text,
  ADD COLUMN IF NOT EXISTS walkin_phone text;

CREATE INDEX IF NOT EXISTS idx_invoices_walkin_phone ON public.invoices (walkin_phone) WHERE walkin_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_walkin_to_customer(p_phone text, p_customer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_spent numeric := 0;
  v_balance numeric := 0;
  v_visits integer := 0;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  UPDATE public.invoices
     SET customer_id = p_customer_id,
         walkin_name = NULL,
         walkin_phone = NULL
   WHERE walkin_phone = btrim(p_phone);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT COALESCE(SUM(paid_amount),0), COALESCE(SUM(balance),0), COUNT(*)
    INTO v_spent, v_balance, v_visits
    FROM public.invoices WHERE customer_id = p_customer_id;

  UPDATE public.customers
     SET total_spent = v_spent,
         current_balance = v_balance,
         visit_count = v_visits
   WHERE id = p_customer_id;

  RETURN v_count;
END $$;