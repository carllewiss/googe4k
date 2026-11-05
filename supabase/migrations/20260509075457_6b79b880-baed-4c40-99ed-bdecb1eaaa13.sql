
-- ============== Sequences ==============
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS purchase_invoice_seq START 1;

-- ============== Enums ==============
DO $$ BEGIN
  CREATE TYPE purchase_order_status AS ENUM ('draft','issued','received','cancelled','invoiced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_status AS ENUM ('draft','posted','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE purchase_payment_mode AS ENUM ('credit','cash','mpesa','bank');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== Purchase Orders ==============
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE DEFAULT ('PO/' || to_char(now(),'YYYY') || '/' || lpad(nextval('purchase_order_seq')::text,4,'0')),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status purchase_order_status NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  reference text,
  notes text,
  subtotal numeric NOT NULL DEFAULT 0,
  vat_total numeric NOT NULL DEFAULT 0,
  wht_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text,
  quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 16,
  vat_amount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_po ON public.purchase_orders FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY admin_full_po_items ON public.purchase_order_items FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== Extend purchases ==============
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS status purchase_status NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_mode purchase_payment_mode NOT NULL DEFAULT 'credit',
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wht_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS po_id uuid REFERENCES public.purchase_orders(id),
  ADD COLUMN IF NOT EXISTS posted_at timestamptz;

-- Backfill posted_at for existing posted rows
UPDATE public.purchases SET posted_at = created_at WHERE posted_at IS NULL;

-- Auto-generate invoice_number when null
CREATE OR REPLACE FUNCTION public.fill_purchase_invoice_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'BP/INV/' || to_char(now(),'YYYY') || '/' || lpad(nextval('purchase_invoice_seq')::text,4,'0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_pinv_no ON public.purchases;
CREATE TRIGGER trg_fill_pinv_no BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.fill_purchase_invoice_number();

-- ============== Extend purchase_items ==============
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;

-- ============== Receipts ==============
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_full_preceipts ON public.purchase_receipts FOR ALL USING (has_role(auth.uid(),'admin'::app_role));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('purchase-receipts','purchase-receipts', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'purchase-receipts' AND has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins write receipts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'purchase-receipts' AND has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete receipts" ON storage.objects FOR DELETE
  USING (bucket_id = 'purchase-receipts' AND has_role(auth.uid(),'admin'::app_role));

-- ============== GL: only post when posted, include VAT + WHT ==============
CREATE OR REPLACE FUNCTION public.post_purchase_item_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pdate date; v_status purchase_status; v_vat numeric;
BEGIN
  SELECT purchase_date, status INTO v_pdate, v_status FROM public.purchases WHERE id = NEW.purchase_id;
  IF v_status IS DISTINCT FROM 'posted' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  v_vat := COALESCE(NEW.vat_amount, 0);
  PERFORM public.post_journal('purchase_item', NEW.id, 'Stock purchase',
    jsonb_build_array(
      jsonb_build_object('account','1200','debit', NEW.total - v_vat),
      jsonb_build_object('account','1300','debit', v_vat),
      jsonb_build_object('account','2000','credit', NEW.total)
    ),
    COALESCE(v_pdate, CURRENT_DATE));
  RETURN NEW;
END $$;

-- When a purchase is updated to posted, fire posting for its items + WHT/Cash settlement
CREATE OR REPLACE FUNCTION public.on_purchase_posted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  it RECORD; v_lines jsonb;
BEGIN
  IF NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted') THEN
    NEW.posted_at := now();
    -- (Re)post each item line via existing trigger logic by faking insert
    FOR it IN SELECT * FROM public.purchase_items WHERE purchase_id = NEW.id LOOP
      PERFORM public.post_journal('purchase_item', it.id, 'Stock purchase',
        jsonb_build_array(
          jsonb_build_object('account','1200','debit', it.total - COALESCE(it.vat_amount,0)),
          jsonb_build_object('account','1300','debit', COALESCE(it.vat_amount,0)),
          jsonb_build_object('account','2000','credit', it.total)
        ), NEW.purchase_date);
    END LOOP;
    -- WHT (if any): debit AP, credit WHT payable (account 2200 if exists)
    IF COALESCE(NEW.wht_total,0) > 0 THEN
      PERFORM public.post_journal('purchase_wht', NEW.id, 'Withholding tax on '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.wht_total),
          jsonb_build_object('account','2500','credit', NEW.wht_total, 'memo','WHT payable (suspense fallback)')
        ), NEW.purchase_date);
    END IF;
    -- Cash/M-Pesa settlement (immediate payment)
    IF NEW.payment_mode = 'cash' AND NEW.total > 0 THEN
      PERFORM public.post_journal('purchase_payment', NEW.id, 'Cash paid for '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.total - COALESCE(NEW.wht_total,0)),
          jsonb_build_object('account','1000','credit', NEW.total - COALESCE(NEW.wht_total,0))
        ), NEW.purchase_date);
    ELSIF NEW.payment_mode = 'mpesa' AND NEW.total > 0 THEN
      PERFORM public.post_journal('purchase_payment', NEW.id, 'M-Pesa paid for '||NEW.invoice_number,
        jsonb_build_array(
          jsonb_build_object('account','2000','debit', NEW.total - COALESCE(NEW.wht_total,0)),
          jsonb_build_object('account','1030','credit', NEW.total - COALESCE(NEW.wht_total,0))
        ), NEW.purchase_date);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_purchase_posted ON public.purchases;
CREATE TRIGGER trg_purchase_posted BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.on_purchase_posted();

-- ============== RPC: post draft purchase (creates batches) ==============
CREATE OR REPLACE FUNCTION public.post_purchase(p_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_purchase RECORD; it RECORD; v_batch uuid;
BEGIN
  SELECT * INTO v_purchase FROM public.purchases WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF v_purchase.status = 'posted' THEN RAISE EXCEPTION 'Already posted'; END IF;

  FOR it IN SELECT * FROM public.purchase_items WHERE purchase_id = p_id LOOP
    INSERT INTO public.stock_batches(product_id, supplier_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
    VALUES (it.product_id, v_purchase.supplier_id, it.quantity, it.quantity, it.unit_cost, v_purchase.purchase_date)
    RETURNING id INTO v_batch;
    UPDATE public.purchase_items SET batch_id = v_batch WHERE id = it.id;
  END LOOP;

  UPDATE public.purchases SET status = 'posted' WHERE id = p_id;
  RETURN p_id;
END $$;

-- Convert PO -> draft purchase
CREATE OR REPLACE FUNCTION public.convert_po_to_invoice(p_po_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_po RECORD; v_pid uuid; it RECORD;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PO not found'; END IF;

  INSERT INTO public.purchases(supplier_id, purchase_date, total, subtotal, vat_total, notes, status, po_id, payment_mode)
  VALUES (v_po.supplier_id, CURRENT_DATE, v_po.total, v_po.subtotal, v_po.vat_total, v_po.notes, 'draft', p_po_id, 'credit')
  RETURNING id INTO v_pid;

  FOR it IN SELECT * FROM public.purchase_order_items WHERE po_id = p_po_id LOOP
    INSERT INTO public.purchase_items(purchase_id, product_id, quantity, unit_cost, total, vat_rate, vat_amount, description)
    VALUES (v_pid, it.product_id, it.quantity, it.unit_cost, it.line_total, it.vat_rate, it.vat_amount, it.description);
  END LOOP;

  UPDATE public.purchase_orders SET status = 'invoiced' WHERE id = p_po_id;
  RETURN v_pid;
END $$;
