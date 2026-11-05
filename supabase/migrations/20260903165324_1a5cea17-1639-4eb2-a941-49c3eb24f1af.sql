-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.purchase_line_type AS ENUM ('stock','expense','service','asset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vat_treatment AS ENUM ('standard','zero_rated','exempt','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_payment_method AS ENUM ('cash','mpesa','bank','cheque','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_charge_type AS ENUM ('none','mpesa_fee','bank_charge','transfer_fee','cheque_fee','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PURCHASE LINES ============
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS line_type public.purchase_line_type NOT NULL DEFAULT 'stock',
  ADD COLUMN IF NOT EXISTS vat_treatment public.vat_treatment NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS expense_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS asset_category public.asset_category,
  ADD COLUMN IF NOT EXISTS asset_useful_life integer,
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.fixed_assets(id),
  ADD COLUMN IF NOT EXISTS warehouse text;

ALTER TABLE public.purchase_items ALTER COLUMN product_id DROP NOT NULL;

-- ============ PURCHASE HEADER ============
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'Kakamega Main Store';

-- ============ SUPPLIER PAYMENTS ============
CREATE SEQUENCE IF NOT EXISTS public.supplier_payment_no_seq;

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method public.supplier_payment_method NOT NULL DEFAULT 'cash',
  payment_account_id uuid REFERENCES public.accounts(id),
  reference text,
  amount numeric NOT NULL DEFAULT 0,
  charge_type public.payment_charge_type NOT NULL DEFAULT 'none',
  charge_amount numeric NOT NULL DEFAULT 0,
  charge_account_id uuid REFERENCES public.accounts(id),
  notes text,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view supplier payments" ON public.supplier_payments
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id),
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.supplier_payment_allocations TO authenticated;
GRANT ALL ON public.supplier_payment_allocations TO service_role;
ALTER TABLE public.supplier_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view payment allocations" ON public.supplier_payment_allocations
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sp_supplier ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spa_purchase ON public.supplier_payment_allocations(purchase_id);

CREATE TRIGGER trg_supplier_payments_updated BEFORE UPDATE ON public.supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHARGE ACCOUNT MAPPING ============
CREATE OR REPLACE FUNCTION public.payment_charge_account(p_type public.payment_charge_type)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'mpesa_fee' THEN '7020'
    WHEN 'bank_charge' THEN '7000'
    WHEN 'transfer_fee' THEN '7000'
    WHEN 'cheque_fee' THEN '7000'
    WHEN 'other' THEN '6900'
    ELSE NULL END;
$$;

-- ============ TYPE-AWARE PURCHASE POSTING ============
CREATE OR REPLACE FUNCTION public.on_purchase_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE it RECORD; v_net numeric; v_vat numeric; v_acct text;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    NEW.posted_at := now();

    FOR it IN SELECT * FROM public.purchase_items WHERE purchase_id = NEW.id LOOP
      v_vat := COALESCE(it.vat_amount, 0);
      v_net := COALESCE(it.total, 0) - v_vat;

      IF it.line_type = 'asset' THEN
        -- asset cost is posted by the fixed_assets trigger; only VAT here
        IF v_vat > 0 THEN
          PERFORM public.post_journal('purchase_item', it.id, 'Asset purchase VAT',
            jsonb_build_array(
              jsonb_build_object('account','1300','debit', v_vat),
              jsonb_build_object('account','2000','credit', v_vat)
            ), NEW.purchase_date);
        END IF;
        CONTINUE;
      END IF;

      IF it.line_type = 'stock' THEN
        v_acct := '1200';
      ELSE
        SELECT code INTO v_acct FROM public.accounts WHERE id = it.expense_account_id;
        v_acct := COALESCE(v_acct, '6900');
      END IF;

      IF COALESCE(it.total,0) <> 0 THEN
        PERFORM public.post_journal('purchase_item', it.id,
          CASE it.line_type WHEN 'stock' THEN 'Stock purchase' ELSE 'Purchase - ' || it.line_type::text END,
          jsonb_build_array(
            jsonb_build_object('account', v_acct, 'debit', v_net),
            jsonb_build_object('account','1300','debit', v_vat),
            jsonb_build_object('account','2000','credit', it.total)
          ), NEW.purchase_date);
      END IF;
    END LOOP;

    IF COALESCE(NEW.wht_total,0) > 0 THEN
      PERFORM public.post_journal('purchase_wht', NEW.id, 'Withholding tax on '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.wht_total),
          jsonb_build_object('account','2500','credit', NEW.wht_total, 'memo','WHT payable')
        ), NEW.purchase_date);
    END IF;

    IF NEW.payment_mode = 'cash' AND NEW.total > 0 THEN
      PERFORM public.post_journal('purchase_payment', NEW.id, 'Cash paid for '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.total - COALESCE(NEW.wht_total,0)),
          jsonb_build_object('account','1000','credit', NEW.total - COALESCE(NEW.wht_total,0))
        ), NEW.purchase_date);
      NEW.amount_paid := NEW.total - COALESCE(NEW.wht_total,0);
    ELSIF NEW.payment_mode = 'mpesa' AND NEW.total > 0 THEN
      PERFORM public.post_journal('purchase_payment', NEW.id, 'M-Pesa paid for '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.total - COALESCE(NEW.wht_total,0)),
          jsonb_build_object('account','1030','credit', NEW.total - COALESCE(NEW.wht_total,0))
        ), NEW.purchase_date);
      NEW.amount_paid := NEW.total - COALESCE(NEW.wht_total,0);
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- purchase_items insert trigger: keep type-aware, skip assets
CREATE OR REPLACE FUNCTION public.post_purchase_item_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pdate date; v_status purchase_status; v_vat numeric; v_acct text;
BEGIN
  SELECT purchase_date, status INTO v_pdate, v_status FROM public.purchases WHERE id = NEW.purchase_id;
  IF v_status IS DISTINCT FROM 'posted' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  IF NEW.line_type = 'asset' THEN RETURN NEW; END IF;
  v_vat := COALESCE(NEW.vat_amount, 0);
  IF NEW.line_type = 'stock' THEN v_acct := '1200';
  ELSE
    SELECT code INTO v_acct FROM public.accounts WHERE id = NEW.expense_account_id;
    v_acct := COALESCE(v_acct, '6900');
  END IF;
  PERFORM public.post_journal('purchase_item', NEW.id, 'Purchase line',
    jsonb_build_array(
      jsonb_build_object('account', v_acct, 'debit', NEW.total - v_vat),
      jsonb_build_object('account','1300','debit', v_vat),
      jsonb_build_object('account','2000','credit', NEW.total)
    ), COALESCE(v_pdate, CURRENT_DATE));
  RETURN NEW;
END $$;

-- post_purchase: stock -> batches, asset -> fixed asset register
CREATE OR REPLACE FUNCTION public.post_purchase(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_purchase RECORD; it RECORD; v_batch uuid; v_asset uuid; v_net numeric; i integer;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF v_purchase.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  FOR it IN SELECT * FROM public.purchase_items WHERE purchase_id = p_id LOOP
    IF it.line_type = 'stock' AND it.product_id IS NOT NULL THEN
      INSERT INTO public.stock_batches(product_id, supplier_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
      VALUES (it.product_id, v_purchase.supplier_id, it.quantity, it.quantity, it.unit_cost, v_purchase.purchase_date)
      RETURNING id INTO v_batch;
      UPDATE public.purchase_items SET batch_id = v_batch WHERE id = it.id;

    ELSIF it.line_type = 'asset' THEN
      v_net := it.unit_cost;
      FOR i IN 1..GREATEST(it.quantity,1) LOOP
        INSERT INTO public.fixed_assets(name, category, supplier_id, purchase_date, purchase_cost,
          useful_life_years, location, notes, created_by)
        VALUES (COALESCE(it.description,'Asset'), COALESCE(it.asset_category,'other'), v_purchase.supplier_id,
          v_purchase.purchase_date, v_net, COALESCE(it.asset_useful_life, 5),
          COALESCE(v_purchase.warehouse,'Kakamega Main Store'),
          'From purchase ' || COALESCE(v_purchase.invoice_number, v_purchase.purchase_code), auth.uid())
        RETURNING id INTO v_asset;
      END LOOP;
      UPDATE public.purchase_items SET asset_id = v_asset WHERE id = it.id;
    END IF;
  END LOOP;

  UPDATE public.purchases SET status = 'posted' WHERE id = p_id;
  RETURN p_id;
END $$;

-- ============ SUPPLIER PAYMENT ============
CREATE OR REPLACE FUNCTION public.pay_supplier(
  p_supplier_id uuid,
  p_amount numeric,
  p_method public.supplier_payment_method,
  p_payment_account text,
  p_reference text DEFAULT NULL,
  p_charge_type public.payment_charge_type DEFAULT 'none',
  p_charge_amount numeric DEFAULT 0,
  p_allocations jsonb DEFAULT '[]'::jsonb,
  p_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid; v_no text; v_elem jsonb; v_alloc numeric := 0; v_amt numeric;
  v_pid uuid; v_pay_acct uuid; v_charge_code text; v_charge_acct uuid;
  v_lines jsonb := '[]'::jsonb; v_j uuid; v_outstanding numeric; r RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can pay suppliers'; END IF;
  IF COALESCE(p_amount,0) <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

  SELECT id INTO v_pay_acct FROM public.accounts WHERE code = p_payment_account;
  IF v_pay_acct IS NULL THEN RAISE EXCEPTION 'Payment account % not found', p_payment_account; END IF;

  v_charge_code := public.payment_charge_account(p_charge_type);
  IF v_charge_code IS NOT NULL THEN
    SELECT id INTO v_charge_acct FROM public.accounts WHERE code = v_charge_code;
  END IF;

  v_no := 'SP-' || to_char(p_date,'YYYY') || '-' || lpad(nextval('public.supplier_payment_no_seq')::text, 5, '0');

  INSERT INTO public.supplier_payments(payment_no, supplier_id, payment_date, method, payment_account_id,
    reference, amount, charge_type, charge_amount, charge_account_id, notes, created_by)
  VALUES (v_no, p_supplier_id, p_date, p_method, v_pay_acct, p_reference, p_amount,
    p_charge_type, COALESCE(p_charge_amount,0), v_charge_acct, p_notes, auth.uid())
  RETURNING id INTO v_id;

  -- explicit allocations
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations,'[]'::jsonb)) LOOP
    v_pid := (v_elem->>'purchase_id')::uuid;
    v_amt := COALESCE((v_elem->>'amount')::numeric, 0);
    IF v_amt <= 0 THEN CONTINUE; END IF;
    INSERT INTO public.supplier_payment_allocations(payment_id, purchase_id, amount)
    VALUES (v_id, v_pid, v_amt);
    UPDATE public.purchases SET amount_paid = amount_paid + v_amt WHERE id = v_pid;
    v_alloc := v_alloc + v_amt;
  END LOOP;

  -- auto-allocate remainder oldest-first
  IF v_alloc < p_amount THEN
    FOR r IN
      SELECT id, (total - COALESCE(wht_total,0) - amount_paid) AS due
      FROM public.purchases
      WHERE supplier_id = p_supplier_id AND status = 'posted' AND payment_mode = 'credit'
        AND (total - COALESCE(wht_total,0) - amount_paid) > 0
      ORDER BY COALESCE(invoice_date, purchase_date), created_at
    LOOP
      EXIT WHEN v_alloc >= p_amount;
      v_amt := LEAST(r.due, p_amount - v_alloc);
      INSERT INTO public.supplier_payment_allocations(payment_id, purchase_id, amount)
      VALUES (v_id, r.id, v_amt);
      UPDATE public.purchases SET amount_paid = amount_paid + v_amt WHERE id = r.id;
      v_alloc := v_alloc + v_amt;
    END LOOP;
  END IF;

  v_lines := v_lines || jsonb_build_object('account','2000','debit', p_amount);
  IF COALESCE(p_charge_amount,0) > 0 AND v_charge_code IS NOT NULL THEN
    v_lines := v_lines || jsonb_build_object('account', v_charge_code, 'debit', p_charge_amount, 'memo','Payment charge');
  END IF;
  v_lines := v_lines || jsonb_build_object('account', p_payment_account, 'credit', p_amount + COALESCE(p_charge_amount,0));

  v_j := public.post_journal('supplier_payment', v_id,
    'Supplier payment ' || v_no, v_lines, p_date);

  UPDATE public.supplier_payments SET journal_id = v_j WHERE id = v_id;
  RETURN v_id;
END $$;