CREATE TABLE public.opening_stock_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  item_count integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.opening_stock_runs TO authenticated;
GRANT ALL ON public.opening_stock_runs TO service_role;

ALTER TABLE public.opening_stock_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view opening stock runs" ON public.opening_stock_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create opening stock runs" ON public.opening_stock_runs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.post_opening_stock(
  p_items jsonb,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_elem jsonb;
  v_pid uuid;
  v_qty integer;
  v_cost numeric;
  v_total numeric := 0;
  v_count integer := 0;
  v_is_service boolean;
  v_journal uuid;
  v_run uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can post opening stock';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_elem->>'product_id')::uuid;
    v_qty := COALESCE((v_elem->>'quantity')::integer, 0);
    v_cost := COALESCE((v_elem->>'unit_cost')::numeric, 0);

    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT is_service INTO v_is_service FROM public.products WHERE id = v_pid;
    IF v_is_service IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_pid;
    END IF;
    IF v_is_service THEN
      RAISE EXCEPTION 'Services cannot carry opening stock';
    END IF;

    INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
    VALUES (v_pid, v_qty, v_qty, v_cost, p_entry_date);

    v_total := v_total + (v_qty * v_cost);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No valid opening stock lines supplied';
  END IF;

  IF v_total > 0 THEN
    v_journal := public.post_journal(
      'opening_stock', gen_random_uuid(),
      COALESCE(p_notes, 'Opening stock brought forward'),
      jsonb_build_array(
        jsonb_build_object('account','1200','debit', v_total),
        jsonb_build_object('account','3000','credit', v_total)
      ),
      p_entry_date);
  END IF;

  INSERT INTO public.opening_stock_runs(entry_date, notes, item_count, total_value, journal_id, created_by)
  VALUES (p_entry_date, p_notes, v_count, v_total, v_journal, auth.uid())
  RETURNING id INTO v_run;

  RETURN v_run;
END $$;