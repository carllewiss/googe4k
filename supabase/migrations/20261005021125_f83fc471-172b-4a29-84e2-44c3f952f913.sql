
-- Correct a point-of-sale payment recorded on an invoice (wrong method split or wrong amount).
-- Posts a GL correction dated today and updates the invoice's cash/mpesa/paid/balance.
CREATE OR REPLACE FUNCTION public.correct_sale_payment(
  p_invoice_id uuid,
  p_cash_amount numeric,
  p_mpesa_amount numeric,
  p_reason_code text,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv record;
  v_old_total numeric;
  v_new_total numeric;
  v_diff numeric;
  v_journal_id uuid;
  v_corr_id uuid;
  v_corr_no text;
  v_cash_acct uuid;
  v_mpesa_acct uuid;
  v_ar_acct uuid;
  v_period text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can correct payments';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'cancelled' THEN RAISE EXCEPTION 'Cannot correct a cancelled invoice'; END IF;

  v_old_total := COALESCE(v_inv.cash_amount,0) + COALESCE(v_inv.mpesa_amount,0);
  v_new_total := COALESCE(p_cash_amount,0) + COALESCE(p_mpesa_amount,0);
  IF v_new_total < 0 THEN RAISE EXCEPTION 'Amounts cannot be negative'; END IF;
  IF v_new_total > v_inv.total THEN RAISE EXCEPTION 'Paid amount (%) cannot exceed the invoice total (%)', v_new_total, v_inv.total; END IF;
  IF v_new_total = v_old_total AND COALESCE(p_cash_amount,0) = COALESCE(v_inv.cash_amount,0) THEN
    RAISE EXCEPTION 'Nothing changed';
  END IF;

  v_diff := v_old_total - v_new_total; -- positive = customer now owes more

  SELECT id INTO v_cash_acct  FROM public.accounts WHERE code = '1000';
  SELECT id INTO v_mpesa_acct FROM public.accounts WHERE code = '1030';
  SELECT id INTO v_ar_acct    FROM public.accounts WHERE code = '1100';

  -- Journal: rebalance the tills, and move any shortfall to Accounts Receivable
  INSERT INTO public.journal_entries (entry_date, reference_type, reference_id, description, created_by)
  VALUES (CURRENT_DATE, 'payment_correction', p_invoice_id,
          'Sale payment correction on ' || v_inv.invoice_number || ': ' || p_reason, auth.uid())
  RETURNING id INTO v_journal_id;

  -- Cash leg
  IF COALESCE(p_cash_amount,0) <> COALESCE(v_inv.cash_amount,0) THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, memo)
    VALUES (v_journal_id, v_cash_acct,
            GREATEST(p_cash_amount - COALESCE(v_inv.cash_amount,0), 0),
            GREATEST(COALESCE(v_inv.cash_amount,0) - p_cash_amount, 0),
            'Cash till correction');
  END IF;
  -- M-Pesa leg
  IF COALESCE(p_mpesa_amount,0) <> COALESCE(v_inv.mpesa_amount,0) THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, memo)
    VALUES (v_journal_id, v_mpesa_acct,
            GREATEST(p_mpesa_amount - COALESCE(v_inv.mpesa_amount,0), 0),
            GREATEST(COALESCE(v_inv.mpesa_amount,0) - p_mpesa_amount, 0),
            'M-Pesa till correction');
  END IF;
  -- Amount shortfall becomes customer debt (AR), balanced against the tills above
  IF v_diff > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, memo)
    VALUES (v_journal_id, v_ar_acct, v_diff, 0, 'Amount under-recorded at sale — now owed by customer');
  ELSIF v_diff < 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, memo)
    VALUES (v_journal_id, v_ar_acct, 0, -v_diff, 'Amount over-recorded at sale — reduces customer debt');
  END IF;

  -- Keep the journal balanced: the till legs already net to -v_diff, AR leg nets to +v_diff. Verified by construction.

  UPDATE public.invoices SET
    cash_amount  = COALESCE(p_cash_amount,0),
    mpesa_amount = COALESCE(p_mpesa_amount,0),
    paid_amount  = v_new_total,
    balance      = v_inv.total - v_new_total,
    status       = CASE WHEN v_inv.total - v_new_total <= 0 THEN 'paid'
                        WHEN v_new_total > 0 THEN 'partial' ELSE 'unpaid' END
  WHERE id = p_invoice_id;

  SELECT period_status INTO v_period FROM public.accounting_periods
  WHERE v_inv.created_at::date BETWEEN start_date AND end_date LIMIT 1;

  v_corr_no := 'PCR-' || to_char(CURRENT_DATE,'YYYY') || '-' || lpad((
    SELECT COUNT(*)+1 FROM public.payment_corrections WHERE correction_no LIKE 'PCR-' || to_char(CURRENT_DATE,'YYYY') || '-%')::text, 5, '0');

  INSERT INTO public.payment_corrections
    (correction_no, kind, payment_id, invoice_id, journal_id, amount, from_account, to_account, reason_code, reason, posting_date, original_period_status, created_by)
  VALUES
    (v_corr_no, 'account_correction', NULL, p_invoice_id, v_journal_id, ABS(v_new_total - v_old_total) + ABS(COALESCE(p_cash_amount,0)-COALESCE(v_inv.cash_amount,0)),
     'cash ' || COALESCE(v_inv.cash_amount,0) || ' / mpesa ' || COALESCE(v_inv.mpesa_amount,0),
     'cash ' || COALESCE(p_cash_amount,0) || ' / mpesa ' || COALESCE(p_mpesa_amount,0),
     p_reason_code, p_reason, CURRENT_DATE, COALESCE(v_period,'open'), auth.uid())
  RETURNING id INTO v_corr_id;

  RETURN v_corr_id;
END;
$$;
