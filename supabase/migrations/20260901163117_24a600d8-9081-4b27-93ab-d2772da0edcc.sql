
REVOKE EXECUTE ON FUNCTION public.post_inventory_adjustment(public.adjustment_type, text, text, jsonb, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.adjustment_accounts(public.adjustment_type) FROM anon, public;

INSERT INTO public.accounts(code,name,type) VALUES
  ('6300','Depreciation Expense','expense'),
  ('4400','Gain on Disposal of Assets','income'),
  ('7100','Loss on Disposal of Assets','expense'),
  ('1530','Office Equipment','asset')
ON CONFLICT (code) DO NOTHING;

-- ============ RETURNS (RMA) ============
CREATE TYPE public.return_kind AS ENUM ('customer','supplier');
CREATE TYPE public.return_reason AS ENUM ('damaged','expired','wrong_item','faulty','other');
CREATE TYPE public.return_resolution AS ENUM ('pending','credit_note','replacement','refund','scrap','supplier_claim');
CREATE TYPE public.return_status AS ENUM ('logged','approved','resolved','cancelled');

CREATE SEQUENCE IF NOT EXISTS public.rma_no_seq;

CREATE TABLE public.goods_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_no text NOT NULL UNIQUE,
  kind public.return_kind NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_id uuid REFERENCES public.customers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  invoice_id uuid REFERENCES public.invoices(id),
  purchase_id uuid REFERENCES public.purchases(id),
  reason public.return_reason NOT NULL DEFAULT 'other',
  resolution public.return_resolution NOT NULL DEFAULT 'pending',
  status public.return_status NOT NULL DEFAULT 'logged',
  restock boolean NOT NULL DEFAULT true,
  notes text,
  total_value numeric NOT NULL DEFAULT 0,
  credit_note_id uuid REFERENCES public.credit_notes(id),
  adjustment_id uuid REFERENCES public.inventory_adjustments(id),
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.goods_returns TO authenticated;
GRANT INSERT, UPDATE ON public.goods_returns TO authenticated;
GRANT ALL ON public.goods_returns TO service_role;
ALTER TABLE public.goods_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view returns" ON public.goods_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage returns" ON public.goods_returns FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update returns" ON public.goods_returns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.goods_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.goods_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_value numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  condition_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.goods_return_items TO authenticated;
GRANT ALL ON public.goods_return_items TO service_role;
ALTER TABLE public.goods_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view return items" ON public.goods_return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add return items" ON public.goods_return_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.goods_return_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.goods_returns(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.goods_return_attachments TO authenticated;
GRANT ALL ON public.goods_return_attachments TO service_role;
ALTER TABLE public.goods_return_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view return evidence" ON public.goods_return_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add return evidence" ON public.goods_return_attachments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_returns_updated BEFORE UPDATE ON public.goods_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_rma_no()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.rma_no IS NULL OR NEW.rma_no = '' THEN
    NEW.rma_no := 'RMA-' || to_char(COALESCE(NEW.return_date, CURRENT_DATE),'YYYY') || '-' ||
                  lpad(nextval('public.rma_no_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_rma_no BEFORE INSERT ON public.goods_returns
  FOR EACH ROW EXECUTE FUNCTION public.set_rma_no();

-- Supplier return: stock out at FIFO cost, reduce AP (Dr AP, Cr Inventory)
CREATE OR REPLACE FUNCTION public.post_supplier_return(p_return_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r RECORD; it RECORD; v_cogs numeric; v_total numeric := 0; v_j uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO r FROM public.goods_returns WHERE id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return not found'; END IF;
  IF r.status = 'resolved' THEN RAISE EXCEPTION 'Return already resolved'; END IF;
  IF r.kind <> 'supplier' THEN RAISE EXCEPTION 'Not a supplier return'; END IF;

  FOR it IN SELECT * FROM public.goods_return_items WHERE return_id = p_return_id LOOP
    v_cogs := public.deduct_stock_fifo(it.product_id, it.quantity);
    v_total := v_total + v_cogs;
  END LOOP;

  IF v_total > 0 THEN
    v_j := public.post_journal('supplier_return', p_return_id, 'Supplier return ' || r.rma_no,
      jsonb_build_array(
        jsonb_build_object('account','2000','debit', v_total),
        jsonb_build_object('account','1200','credit', v_total)
      ), r.return_date);
  END IF;

  UPDATE public.goods_returns
     SET status='resolved', resolution='supplier_claim', total_value=v_total, journal_id=v_j
   WHERE id = p_return_id;
  RETURN v_j;
END $$;
REVOKE EXECUTE ON FUNCTION public.post_supplier_return(uuid) FROM anon, public;

-- ============ FIXED ASSETS ============
CREATE TYPE public.asset_category AS ENUM ('computer','printer','router','furniture','vehicle','ups','generator','other');
CREATE TYPE public.asset_status AS ENUM ('active','under_maintenance','disposed','written_off');
CREATE TYPE public.disposal_method AS ENUM ('sale','scrap','write_off','donation');

CREATE SEQUENCE IF NOT EXISTS public.asset_no_seq;

CREATE TABLE public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_no text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.asset_category NOT NULL DEFAULT 'other',
  serial_number text,
  location text,
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  purchase_cost numeric NOT NULL DEFAULT 0,
  salvage_value numeric NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL DEFAULT 4,
  accumulated_depreciation numeric NOT NULL DEFAULT 0,
  warranty_expiry date,
  image_url text,
  status public.asset_status NOT NULL DEFAULT 'active',
  notes text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view assets" ON public.fixed_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins add assets" ON public.fixed_assets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins edit assets" ON public.fixed_assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.asset_depreciation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_date date NOT NULL,
  amount numeric NOT NULL,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, period_date)
);
GRANT SELECT ON public.asset_depreciation TO authenticated;
GRANT ALL ON public.asset_depreciation TO service_role;
ALTER TABLE public.asset_depreciation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view depreciation" ON public.asset_depreciation FOR SELECT TO authenticated USING (true);

CREATE TABLE public.asset_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  provider text,
  description text,
  cost numeric NOT NULL DEFAULT 0,
  next_service_date date,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.asset_maintenance TO authenticated;
GRANT ALL ON public.asset_maintenance TO service_role;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view maintenance" ON public.asset_maintenance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins log maintenance" ON public.asset_maintenance FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  method public.disposal_method NOT NULL DEFAULT 'scrap',
  proceeds numeric NOT NULL DEFAULT 0,
  net_book_value numeric NOT NULL DEFAULT 0,
  gain_loss numeric NOT NULL DEFAULT 0,
  notes text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_disposals TO authenticated;
GRANT ALL ON public.asset_disposals TO service_role;
ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view disposals" ON public.asset_disposals FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.asset_account_code(p_cat public.asset_category)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_cat
    WHEN 'furniture' THEN '1500'
    WHEN 'vehicle' THEN '1520'
    WHEN 'computer' THEN '1510'
    WHEN 'printer' THEN '1510'
    ELSE '1530' END;
$$;

CREATE OR REPLACE FUNCTION public.set_asset_no()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.asset_no IS NULL OR NEW.asset_no = '' THEN
    NEW.asset_no := 'FA-' || lpad(nextval('public.asset_no_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_asset_no BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_asset_no();

-- Capitalise asset on creation: Dr asset account, Cr Cash (or AP if supplier credit)
CREATE OR REPLACE FUNCTION public.post_asset_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_j uuid;
BEGIN
  IF COALESCE(NEW.purchase_cost,0) > 0 THEN
    v_j := public.post_journal('asset_purchase', NEW.id, 'Asset ' || NEW.asset_no || ' - ' || NEW.name,
      jsonb_build_array(
        jsonb_build_object('account', public.asset_account_code(NEW.category), 'debit', NEW.purchase_cost),
        jsonb_build_object('account', CASE WHEN NEW.supplier_id IS NULL THEN '1000' ELSE '2000' END, 'credit', NEW.purchase_cost)
      ), NEW.purchase_date);
    NEW.journal_id := v_j;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_asset_purchase BEFORE INSERT ON public.fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.post_asset_purchase();

CREATE OR REPLACE FUNCTION public.post_asset_maintenance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_j uuid;
BEGIN
  IF COALESCE(NEW.cost,0) > 0 THEN
    v_j := public.post_journal('asset_maintenance', NEW.id,
      'Maintenance: ' || COALESCE(NEW.description,''),
      jsonb_build_array(
        jsonb_build_object('account','6060','debit', NEW.cost),
        jsonb_build_object('account','1000','credit', NEW.cost)
      ), NEW.service_date);
    NEW.journal_id := v_j;
  END IF;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END $$;
CREATE TRIGGER trg_asset_maintenance BEFORE INSERT ON public.asset_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.post_asset_maintenance();

-- Monthly straight-line depreciation run for all active assets
CREATE OR REPLACE FUNCTION public.run_asset_depreciation(p_period date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  a RECORD; v_month date := date_trunc('month', p_period)::date;
  v_amt numeric; v_nbv numeric; v_total numeric := 0; v_count integer := 0; v_j uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;

  FOR a IN SELECT * FROM public.fixed_assets WHERE status = 'active' AND purchase_date <= (v_month + interval '1 month - 1 day')::date LOOP
    IF EXISTS (SELECT 1 FROM public.asset_depreciation WHERE asset_id = a.id AND period_date = v_month) THEN CONTINUE; END IF;
    IF a.useful_life_years <= 0 THEN CONTINUE; END IF;
    v_amt := round(GREATEST(a.purchase_cost - a.salvage_value, 0) / (a.useful_life_years * 12.0), 2);
    v_nbv := a.purchase_cost - a.accumulated_depreciation - a.salvage_value;
    IF v_nbv <= 0 THEN CONTINUE; END IF;
    v_amt := LEAST(v_amt, v_nbv);
    IF v_amt <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.asset_depreciation(asset_id, period_date, amount, created_by)
    VALUES (a.id, v_month, v_amt, auth.uid());

    UPDATE public.fixed_assets SET accumulated_depreciation = accumulated_depreciation + v_amt WHERE id = a.id;
    v_total := v_total + v_amt;
    v_count := v_count + 1;
  END LOOP;

  IF v_total > 0 THEN
    v_j := public.post_journal('depreciation', gen_random_uuid(),
      'Depreciation for ' || to_char(v_month,'Mon YYYY'),
      jsonb_build_array(
        jsonb_build_object('account','6300','debit', v_total),
        jsonb_build_object('account','1600','credit', v_total)
      ), (v_month + interval '1 month - 1 day')::date);
    UPDATE public.asset_depreciation SET journal_id = v_j WHERE period_date = v_month AND journal_id IS NULL;
  END IF;

  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_asset_depreciation(date) FROM anon, public;

CREATE OR REPLACE FUNCTION public.dispose_asset(
  p_asset_id uuid, p_method public.disposal_method, p_proceeds numeric,
  p_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE a RECORD; v_nbv numeric; v_gain numeric; v_lines jsonb; v_j uuid; v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO a FROM public.fixed_assets WHERE id = p_asset_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found'; END IF;
  IF a.status IN ('disposed','written_off') THEN RAISE EXCEPTION 'Asset already disposed'; END IF;

  v_nbv := a.purchase_cost - a.accumulated_depreciation;
  v_gain := COALESCE(p_proceeds,0) - v_nbv;

  v_lines := '[]'::jsonb;
  IF a.accumulated_depreciation > 0 THEN
    v_lines := v_lines || jsonb_build_object('account','1600','debit', a.accumulated_depreciation);
  END IF;
  IF COALESCE(p_proceeds,0) > 0 THEN
    v_lines := v_lines || jsonb_build_object('account','1000','debit', p_proceeds);
  END IF;
  IF v_gain < 0 THEN
    v_lines := v_lines || jsonb_build_object('account','7100','debit', abs(v_gain));
  END IF;
  v_lines := v_lines || jsonb_build_object('account', public.asset_account_code(a.category), 'credit', a.purchase_cost);
  IF v_gain > 0 THEN
    v_lines := v_lines || jsonb_build_object('account','4400','credit', v_gain);
  END IF;

  v_j := public.post_journal('asset_disposal', p_asset_id,
    'Disposal of ' || a.asset_no || ' - ' || a.name, v_lines, p_date);

  INSERT INTO public.asset_disposals(asset_id, disposal_date, method, proceeds, net_book_value, gain_loss, notes, journal_id, created_by)
  VALUES (p_asset_id, p_date, p_method, COALESCE(p_proceeds,0), v_nbv, v_gain, p_notes, v_j, auth.uid())
  RETURNING id INTO v_id;

  UPDATE public.fixed_assets
     SET status = CASE WHEN p_method = 'sale' THEN 'disposed'::public.asset_status ELSE 'written_off'::public.asset_status END
   WHERE id = p_asset_id;

  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.dispose_asset(uuid, public.disposal_method, numeric, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.asset_account_code(public.asset_category) FROM anon, public;
