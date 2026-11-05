
-- Credit notes feature
CREATE SEQUENCE IF NOT EXISTS credit_note_number_seq START 1;

CREATE TYPE credit_note_refund_method AS ENUM ('none','credit_balance','cash_refund','mpesa_refund');
CREATE TYPE credit_note_status AS ENUM ('issued','void');

CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL DEFAULT ('CN-' || lpad(nextval('credit_note_number_seq')::text, 4, '0')),
  invoice_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  reason text,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  refund_method credit_note_refund_method NOT NULL DEFAULT 'none',
  refund_amount numeric NOT NULL DEFAULT 0,
  status credit_note_status NOT NULL DEFAULT 'issued',
  reprint_count integer NOT NULL DEFAULT 0,
  last_reprinted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  invoice_item_id uuid,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  is_service boolean NOT NULL DEFAULT false,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  restored_to_stock boolean NOT NULL DEFAULT false,
  restore_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cn_invoice ON public.credit_notes(invoice_id);
CREATE INDEX idx_cn_customer ON public.credit_notes(customer_id);
CREATE INDEX idx_cni_product ON public.credit_note_items(product_id);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_full_credit_notes ON public.credit_notes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY agents_view_credit_notes ON public.credit_notes
  FOR SELECT USING (has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY admin_full_credit_note_items ON public.credit_note_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY agents_view_credit_note_items ON public.credit_note_items
  FOR SELECT USING (has_role(auth.uid(), 'sales_agent'::app_role));

CREATE TRIGGER trg_cn_updated_at BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: create credit note + restore stock + adjust invoice/customer
CREATE OR REPLACE FUNCTION public.create_credit_note(
  p_invoice_id uuid,
  p_reason text,
  p_refund_method credit_note_refund_method,
  p_items jsonb -- array of {invoice_item_id, quantity}
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cn_id uuid;
  v_invoice RECORD;
  v_item RECORD;
  v_req_qty integer;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_is_service boolean;
  v_product_name text;
  v_vat_rate numeric;
  v_tax_cat text;
  v_line_tax numeric;
  v_batch_id uuid;
  v_unit_cost numeric;
  v_refund_amount numeric;
  v_new_paid numeric;
  v_new_balance numeric;
  v_new_status invoice_status;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  INSERT INTO public.credit_notes(invoice_id, customer_id, reason, refund_method, created_by)
  VALUES (p_invoice_id, v_invoice.customer_id, p_reason, p_refund_method, auth.uid())
  RETURNING id INTO v_cn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_req_qty := (v_item.value->>'quantity')::int;
    IF v_req_qty <= 0 THEN CONTINUE; END IF;

    SELECT ii.*, p.is_service, p.name AS pname, p.tax_category, p.vat_rate
      INTO v_unit_price, v_is_service, v_product_name, v_tax_cat, v_vat_rate
    FROM public.invoice_items ii
    JOIN public.products p ON p.id = ii.product_id
    WHERE ii.id = (v_item.value->>'invoice_item_id')::uuid
      AND ii.invoice_id = p_invoice_id;

    -- Re-fetch full row (the SELECT above only assigns first cols to v_unit_price); use a clearer query
    SELECT ii.unit_price, ii.cogs, ii.quantity, ii.product_id, p.is_service, p.name, p.tax_category, p.vat_rate
    INTO v_unit_price, v_unit_cost, v_req_qty /*placeholder*/, v_batch_id /*placeholder*/, v_is_service, v_product_name, v_tax_cat, v_vat_rate
    FROM public.invoice_items ii JOIN public.products p ON p.id = ii.product_id
    WHERE ii.id = (v_item.value->>'invoice_item_id')::uuid;

    v_req_qty := (v_item.value->>'quantity')::int;
    v_line_total := v_unit_price * v_req_qty;
    v_line_tax := 0;
    IF v_tax_cat = 'standard' AND COALESCE(v_vat_rate, 0) > 0 THEN
      v_line_tax := v_line_total - (v_line_total / (1 + v_vat_rate/100.0));
    END IF;
    v_subtotal := v_subtotal + (v_line_total - v_line_tax);
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;

    -- Restore stock for products
    v_batch_id := NULL;
    IF NOT v_is_service THEN
      INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
      VALUES (
        (SELECT product_id FROM public.invoice_items WHERE id = (v_item.value->>'invoice_item_id')::uuid),
        v_req_qty, v_req_qty,
        COALESCE(NULLIF(v_unit_cost,0) / NULLIF((SELECT quantity FROM public.invoice_items WHERE id = (v_item.value->>'invoice_item_id')::uuid),0), 0),
        CURRENT_DATE
      )
      RETURNING id INTO v_batch_id;
    END IF;

    INSERT INTO public.credit_note_items(
      credit_note_id, invoice_item_id, product_id, product_name, is_service,
      quantity, unit_price, total, restored_to_stock, restore_batch_id
    )
    SELECT v_cn_id, ii.id, ii.product_id, v_product_name, v_is_service,
           v_req_qty, v_unit_price, v_line_total, NOT v_is_service, v_batch_id
    FROM public.invoice_items ii WHERE ii.id = (v_item.value->>'invoice_item_id')::uuid;
  END LOOP;

  -- Determine refund amount (capped to paid amount)
  v_refund_amount := 0;
  IF p_refund_method IN ('cash_refund','mpesa_refund') THEN
    v_refund_amount := LEAST(v_total, v_invoice.paid_amount);
  ELSIF p_refund_method = 'credit_balance' THEN
    v_refund_amount := LEAST(v_total, v_invoice.paid_amount);
  END IF;

  UPDATE public.credit_notes
    SET subtotal = v_subtotal, tax = v_tax_total, total = v_total, refund_amount = v_refund_amount
    WHERE id = v_cn_id;

  -- Adjust invoice totals
  v_new_paid := GREATEST(v_invoice.paid_amount - v_refund_amount, 0);
  v_new_balance := GREATEST(v_invoice.total - v_total - v_new_paid, 0);
  IF (v_invoice.total - v_total) <= 0 THEN
    v_new_status := 'paid'::invoice_status;
  ELSIF v_new_balance <= 0 THEN
    v_new_status := 'paid'::invoice_status;
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial'::invoice_status;
  ELSE
    v_new_status := 'unpaid'::invoice_status;
  END IF;

  UPDATE public.invoices
    SET total = GREATEST(total - v_total, 0),
        subtotal = GREATEST(subtotal - v_subtotal, 0),
        tax = GREATEST(tax - v_tax_total, 0),
        paid_amount = v_new_paid,
        balance = v_new_balance,
        status = v_new_status
    WHERE id = p_invoice_id;

  -- Adjust customer balance
  IF p_refund_method = 'credit_balance' THEN
    -- Add credit (reduce balance; can go negative meaning store credit)
    UPDATE public.customers
      SET current_balance = current_balance - v_refund_amount,
          total_spent = GREATEST(total_spent - v_refund_amount, 0)
      WHERE id = v_invoice.customer_id;
  ELSIF p_refund_method IN ('cash_refund','mpesa_refund') THEN
    UPDATE public.customers
      SET total_spent = GREATEST(total_spent - v_refund_amount, 0)
      WHERE id = v_invoice.customer_id;
    -- Log negative payment for audit
    INSERT INTO public.payments(invoice_id, customer_id, amount, cash_amount, mpesa_amount, notes, created_by)
    VALUES (
      p_invoice_id, v_invoice.customer_id, -v_refund_amount,
      CASE WHEN p_refund_method='cash_refund' THEN -v_refund_amount ELSE 0 END,
      CASE WHEN p_refund_method='mpesa_refund' THEN -v_refund_amount ELSE 0 END,
      'Refund for credit note', auth.uid()
    );
  ELSE
    -- 'none' (unpaid/partial cancel): reduce outstanding balance already done above
    UPDATE public.customers
      SET current_balance = GREATEST(current_balance - (v_total - v_refund_amount), 0)
      WHERE id = v_invoice.customer_id;
  END IF;

  RETURN v_cn_id;
END;
$$;

-- Reprint counter
CREATE OR REPLACE FUNCTION public.mark_credit_note_reprint(p_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.credit_notes
    SET reprint_count = reprint_count + 1, last_reprinted_at = now()
    WHERE id = p_id
    RETURNING reprint_count INTO v_count;
  RETURN v_count;
END;
$$;
