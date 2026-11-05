
-- Accounts
INSERT INTO public.accounts(code,name,type) VALUES
  ('5100','Inventory Loss - Damaged','expense'),
  ('5110','Expired Stock Expense','expense'),
  ('5120','Inventory Shrinkage','expense'),
  ('5130','Theft Expense','expense'),
  ('4300','Inventory Gain','income'),
  ('2700','Supplier Claims','liability'),
  ('3400','Opening Balance Equity','equity')
ON CONFLICT (code) DO NOTHING;

CREATE TYPE public.adjustment_type AS ENUM (
  'damaged','expired','lost','theft','promotional','internal_use',
  'supplier_replacement','found','opening_correction','data_correction','repackaging'
);

CREATE SEQUENCE IF NOT EXISTS public.adjustment_no_seq;

CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no text NOT NULL UNIQUE,
  adjustment_type public.adjustment_type NOT NULL,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  warehouse text NOT NULL DEFAULT 'Kakamega Main Store',
  reason text,
  notes text,
  total_value numeric NOT NULL DEFAULT 0,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_adjustments TO authenticated;
GRANT ALL ON public.inventory_adjustments TO service_role;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view adjustments" ON public.inventory_adjustments
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.inventory_adjustment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  batch_id uuid REFERENCES public.stock_batches(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_adjustment_items TO authenticated;
GRANT ALL ON public.inventory_adjustment_items TO service_role;
ALTER TABLE public.inventory_adjustment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view adjustment items" ON public.inventory_adjustment_items
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.inventory_adjustment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_adjustment_attachments TO authenticated;
GRANT ALL ON public.inventory_adjustment_attachments TO service_role;
ALTER TABLE public.inventory_adjustment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view adjustment evidence" ON public.inventory_adjustment_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can add adjustment evidence" ON public.inventory_adjustment_attachments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_adj_items_product ON public.inventory_adjustment_items(product_id);
CREATE INDEX idx_adj_date ON public.inventory_adjustments(adjustment_date DESC);

CREATE OR REPLACE FUNCTION public.adjustment_accounts(p_type public.adjustment_type)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_type
    WHEN 'damaged' THEN '5100'
    WHEN 'expired' THEN '5110'
    WHEN 'lost' THEN '5120'
    WHEN 'theft' THEN '5130'
    WHEN 'promotional' THEN '6100'
    WHEN 'internal_use' THEN '6040'
    WHEN 'supplier_replacement' THEN '2700'
    WHEN 'found' THEN '4300'
    WHEN 'opening_correction' THEN '3400'
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.post_inventory_adjustment(
  p_type public.adjustment_type,
  p_reason text,
  p_notes text,
  p_items jsonb,
  p_date date DEFAULT CURRENT_DATE,
  p_warehouse text DEFAULT 'Kakamega Main Store'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid; v_no text; v_elem jsonb; v_pid uuid; v_qty integer; v_cost numeric;
  v_value numeric; v_total numeric := 0; v_count integer := 0;
  v_is_service boolean; v_avail integer; v_name text; v_cogs numeric;
  v_batch uuid; v_contra text; v_journal uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can post inventory adjustments';
  END IF;

  v_no := 'ADJ-' || to_char(p_date,'YYYY') || '-' ||
          lpad(nextval('public.adjustment_no_seq')::text, 6, '0');

  INSERT INTO public.inventory_adjustments(adjustment_no, adjustment_type, adjustment_date,
    warehouse, reason, notes, created_by)
  VALUES (v_no, p_type, p_date, COALESCE(p_warehouse,'Kakamega Main Store'), p_reason, p_notes, auth.uid())
  RETURNING id INTO v_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_elem->>'product_id')::uuid;
    v_qty := COALESCE((v_elem->>'quantity')::integer, 0);
    v_cost := COALESCE((v_elem->>'unit_cost')::numeric, 0);
    v_batch := NULL;

    SELECT is_service, name INTO v_is_service, v_name FROM public.products WHERE id = v_pid;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;

    IF p_type = 'data_correction' THEN
      v_qty := 0; v_value := 0;
    ELSIF v_qty = 0 THEN
      CONTINUE;
    ELSIF v_is_service THEN
      RAISE EXCEPTION 'Services cannot be stock-adjusted (%)', v_name;
    ELSIF v_qty < 0 THEN
      SELECT COALESCE(SUM(quantity_remaining),0)::integer INTO v_avail
        FROM public.stock_batches WHERE product_id = v_pid;
      IF v_avail < abs(v_qty) THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: % has only % units (requested %)', v_name, v_avail, abs(v_qty);
      END IF;
      v_cogs := public.deduct_stock_fifo(v_pid, abs(v_qty));
      v_cost := CASE WHEN abs(v_qty) > 0 THEN v_cogs / abs(v_qty) ELSE 0 END;
      v_value := -v_cogs;
    ELSE
      IF v_cost <= 0 THEN
        SELECT cost_price INTO v_cost FROM public.stock_batches
          WHERE product_id = v_pid ORDER BY purchase_date DESC, created_at DESC LIMIT 1;
        v_cost := COALESCE(v_cost, 0);
      END IF;
      INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
      VALUES (v_pid, v_qty, v_qty, v_cost, p_date) RETURNING id INTO v_batch;
      v_value := v_qty * v_cost;
    END IF;

    INSERT INTO public.inventory_adjustment_items(adjustment_id, product_id, quantity, unit_cost, value, batch_id, notes)
    VALUES (v_id, v_pid, v_qty, v_cost, v_value, v_batch, v_elem->>'notes');

    v_total := v_total + v_value;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'No valid adjustment lines supplied'; END IF;

  v_contra := public.adjustment_accounts(p_type);

  IF v_total <> 0 AND v_contra IS NOT NULL THEN
    IF v_total < 0 THEN
      v_journal := public.post_journal('inventory_adjustment', v_id,
        v_no || ' - ' || COALESCE(p_reason, p_type::text),
        jsonb_build_array(
          jsonb_build_object('account', v_contra, 'debit', abs(v_total)),
          jsonb_build_object('account', '1200', 'credit', abs(v_total))
        ), p_date);
    ELSE
      v_journal := public.post_journal('inventory_adjustment', v_id,
        v_no || ' - ' || COALESCE(p_reason, p_type::text),
        jsonb_build_array(
          jsonb_build_object('account', '1200', 'debit', v_total),
          jsonb_build_object('account', v_contra, 'credit', v_total)
        ), p_date);
    END IF;
  END IF;

  UPDATE public.inventory_adjustments
     SET total_value = v_total, journal_id = v_journal
   WHERE id = v_id;

  RETURN v_id;
END $$;

CREATE TRIGGER trg_inv_adj_updated BEFORE UPDATE ON public.inventory_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
