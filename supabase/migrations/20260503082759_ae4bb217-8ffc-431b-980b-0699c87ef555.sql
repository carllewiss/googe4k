
CREATE OR REPLACE FUNCTION public.create_credit_note(
  p_invoice_id uuid,
  p_reason text,
  p_refund_method credit_note_refund_method,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cn_id uuid;
  v_invoice RECORD;
  v_li RECORD;
  v_elem jsonb;
  v_req_qty integer;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_total numeric := 0;
  v_line_tax numeric;
  v_unit_cost numeric;
  v_batch_id uuid;
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

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_req_qty := (v_elem->>'quantity')::int;
    IF v_req_qty IS NULL OR v_req_qty <= 0 THEN CONTINUE; END IF;

    SELECT
      ii.id          AS invoice_item_id,
      ii.product_id  AS product_id,
      ii.quantity    AS sold_qty,
      ii.unit_price  AS unit_price,
      ii.cogs        AS cogs,
      p.is_service   AS is_service,
      p.name         AS product_name,
      p.tax_category AS tax_category,
      p.vat_rate     AS vat_rate
    INTO v_li
    FROM public.invoice_items ii
    JOIN public.products p ON p.id = ii.product_id
    WHERE ii.id = (v_elem->>'invoice_item_id')::uuid
      AND ii.invoice_id = p_invoice_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice item % not found on invoice', (v_elem->>'invoice_item_id');
    END IF;

    v_line_total := v_li.unit_price * v_req_qty;
    v_line_tax := 0;
    IF v_li.tax_category::text = 'standard' AND COALESCE(v_li.vat_rate, 0) > 0 THEN
      v_line_tax := v_line_total - (v_line_total / (1 + v_li.vat_rate / 100.0));
    END IF;

    v_subtotal := v_subtotal + (v_line_total - v_line_tax);
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;

    v_batch_id := NULL;
    IF NOT v_li.is_service THEN
      v_unit_cost := CASE WHEN v_li.sold_qty > 0 THEN COALESCE(v_li.cogs, 0) / v_li.sold_qty ELSE 0 END;
      INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
      VALUES (v_li.product_id, v_req_qty, v_req_qty, v_unit_cost, CURRENT_DATE)
      RETURNING id INTO v_batch_id;
    END IF;

    INSERT INTO public.credit_note_items(
      credit_note_id, invoice_item_id, product_id, product_name, is_service,
      quantity, unit_price, total, restored_to_stock, restore_batch_id
    )
    VALUES (
      v_cn_id, v_li.invoice_item_id, v_li.product_id, v_li.product_name, v_li.is_service,
      v_req_qty, v_li.unit_price, v_line_total, NOT v_li.is_service, v_batch_id
    );
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Credit note total must be greater than zero';
  END IF;

  v_refund_amount := 0;
  IF p_refund_method IN ('cash_refund','mpesa_refund','credit_balance') THEN
    v_refund_amount := LEAST(v_total, v_invoice.paid_amount);
  END IF;

  UPDATE public.credit_notes
    SET subtotal = v_subtotal, tax = v_tax_total, total = v_total, refund_amount = v_refund_amount
    WHERE id = v_cn_id;

  v_new_paid := GREATEST(v_invoice.paid_amount - v_refund_amount, 0);
  v_new_balance := GREATEST((v_invoice.total - v_total) - v_new_paid, 0);
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

  IF p_refund_method = 'credit_balance' THEN
    UPDATE public.customers
      SET current_balance = current_balance - v_refund_amount,
          total_spent = GREATEST(total_spent - v_refund_amount, 0)
      WHERE id = v_invoice.customer_id;
  ELSIF p_refund_method IN ('cash_refund','mpesa_refund') THEN
    UPDATE public.customers
      SET total_spent = GREATEST(total_spent - v_refund_amount, 0)
      WHERE id = v_invoice.customer_id;
    INSERT INTO public.payments(invoice_id, customer_id, amount, cash_amount, mpesa_amount, notes, created_by)
    VALUES (
      p_invoice_id, v_invoice.customer_id, -v_refund_amount,
      CASE WHEN p_refund_method='cash_refund' THEN -v_refund_amount ELSE 0 END,
      CASE WHEN p_refund_method='mpesa_refund' THEN -v_refund_amount ELSE 0 END,
      'Refund for credit note', auth.uid()
    );
  ELSE
    UPDATE public.customers
      SET current_balance = GREATEST(current_balance - (v_total - v_refund_amount), 0)
      WHERE id = v_invoice.customer_id;
  END IF;

  RETURN v_cn_id;
END;
$$;
