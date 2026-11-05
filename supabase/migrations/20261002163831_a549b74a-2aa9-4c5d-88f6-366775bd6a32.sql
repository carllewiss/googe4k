CREATE TABLE public.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  closed_at timestamptz, closed_by uuid, closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.accounting_periods TO authenticated;
GRANT ALL ON public.accounting_periods TO service_role;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read periods" ON public.accounting_periods FOR SELECT TO authenticated USING (true);

CREATE TABLE public.payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_no text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('reversal','account_correction','reallocation','write_off')),
  payment_id uuid REFERENCES public.payments(id),
  invoice_id uuid REFERENCES public.invoices(id),
  new_invoice_id uuid REFERENCES public.invoices(id),
  customer_id uuid REFERENCES public.customers(id),
  reason_code text NOT NULL,
  reason text,
  amount numeric NOT NULL DEFAULT 0,
  from_account text, to_account text,
  original_date date,
  original_period_status text,
  posting_date date NOT NULL DEFAULT CURRENT_DATE,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_corrections TO authenticated;
GRANT ALL ON public.payment_corrections TO service_role;
ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read corrections" ON public.payment_corrections FOR SELECT TO authenticated USING (true);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

INSERT INTO public.accounts(code,name,type) SELECT '6900','Bad Debts Written Off','expense'
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE code='6900');

CREATE OR REPLACE FUNCTION public.period_status_for(p_date date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE((SELECT status FROM accounting_periods WHERE p_date BETWEEN start_date AND end_date LIMIT 1),'open')
$$;

CREATE OR REPLACE FUNCTION public.guard_journal_period() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF public.period_status_for(NEW.entry_date) <> 'open' THEN
    RAISE EXCEPTION 'Accounting period for % is closed. Post a correction dated in an open period instead.', NEW.entry_date;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_je_period_guard BEFORE INSERT ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.guard_journal_period();

CREATE OR REPLACE FUNCTION public.set_accounting_period(p_year int, p_month int, p_status text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_start date := make_date(p_year,p_month,1); v_id uuid; v_cur text;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF p_status NOT IN ('open','closed','locked') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT status INTO v_cur FROM accounting_periods WHERE start_date=v_start;
  IF v_cur='locked' THEN RAISE EXCEPTION 'Locked periods cannot be changed'; END IF;
  IF p_status <> 'open' AND v_start + interval '1 month' > CURRENT_DATE + 1 AND p_status<>'open' AND v_start > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot close a future period';
  END IF;
  INSERT INTO accounting_periods(period_name,start_date,end_date,status,closed_at,closed_by,closed_reason)
  VALUES (to_char(v_start,'YYYY-MM'), v_start, (v_start + interval '1 month - 1 day')::date, p_status,
    CASE WHEN p_status<>'open' THEN now() END, CASE WHEN p_status<>'open' THEN auth.uid() END, p_reason)
  ON CONFLICT (period_name) DO UPDATE SET status=EXCLUDED.status, closed_at=EXCLUDED.closed_at,
    closed_by=EXCLUDED.closed_by, closed_reason=EXCLUDED.closed_reason
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.next_correction_no() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT 'PCR-' || to_char(now(),'YYYY') || '-' || lpad((COUNT(*)+1)::text,5,'0') FROM payment_corrections
  WHERE correction_no LIKE 'PCR-' || to_char(now(),'YYYY') || '-%'
$$;

CREATE OR REPLACE FUNCTION public.reverse_payment(p_payment_id uuid, p_reason_code text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; v_lines jsonb := '[]'::jsonb; r record; v_j uuid; v_id uuid; v_inv invoices%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO p FROM payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF p.status='reversed' THEN RAISE EXCEPTION 'Payment already reversed'; END IF;
  FOR r IN SELECT a.code, jl.debit, jl.credit FROM journal_lines jl JOIN journal_entries je ON je.id=jl.journal_id
    JOIN accounts a ON a.id=jl.account_id WHERE je.reference_type='payment' AND je.reference_id=p.id AND NOT je.is_reversal LOOP
    v_lines := v_lines || jsonb_build_object('account',r.code,'debit',r.credit,'credit',r.debit,'memo','Reversal');
  END LOOP;
  IF jsonb_array_length(v_lines)>0 THEN
    v_j := post_journal('payment_reversal', p.id, 'Reversal of payment: '||p_reason, v_lines, CURRENT_DATE);
  END IF;
  UPDATE payments SET status='reversed', reversed_at=now() WHERE id=p.id;
  SELECT * INTO v_inv FROM invoices WHERE id=p.invoice_id FOR UPDATE;
  IF FOUND THEN
    UPDATE invoices SET paid_amount=GREATEST(0,paid_amount-p.amount), balance=balance+p.amount,
      status=CASE WHEN paid_amount-p.amount<=0 THEN 'unpaid'::invoice_status ELSE 'partial'::invoice_status END
    WHERE id=v_inv.id;
  END IF;
  UPDATE customers SET current_balance=current_balance+p.amount, total_spent=GREATEST(0,total_spent-p.amount) WHERE id=p.customer_id;
  INSERT INTO payment_corrections(correction_no,kind,payment_id,invoice_id,customer_id,reason_code,reason,amount,original_date,original_period_status,journal_id,created_by)
  VALUES (next_correction_no(),'reversal',p.id,p.invoice_id,p.customer_id,p_reason_code,p_reason,p.amount,p.payment_date::date,period_status_for(p.payment_date::date),v_j,auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.correct_payment_account(p_payment_id uuid, p_from text, p_to text, p_amount numeric, p_reason_code text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; v_j uuid; v_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF p_from=p_to THEN RAISE EXCEPTION 'Accounts must differ'; END IF;
  SELECT * INTO p FROM payments WHERE id=p_payment_id;
  IF NOT FOUND OR p.status='reversed' THEN RAISE EXCEPTION 'Payment not available'; END IF;
  IF p_amount<=0 OR p_amount>p.amount THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  v_j := post_journal('payment_correction', p.id, 'Payment account correction: '||p_reason,
    jsonb_build_array(jsonb_build_object('account',p_to,'debit',p_amount,'memo','Correct account'),
                      jsonb_build_object('account',p_from,'credit',p_amount,'memo','Wrong account')), CURRENT_DATE);
  INSERT INTO payment_corrections(correction_no,kind,payment_id,invoice_id,customer_id,reason_code,reason,amount,from_account,to_account,original_date,original_period_status,journal_id,created_by)
  VALUES (next_correction_no(),'account_correction',p.id,p.invoice_id,p.customer_id,p_reason_code,p_reason,p_amount,p_from,p_to,p.payment_date::date,period_status_for(p.payment_date::date),v_j,auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.reallocate_payment(p_payment_id uuid, p_new_invoice_id uuid, p_reason_code text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; n invoices%ROWTYPE; v_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO p FROM payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR p.status='reversed' THEN RAISE EXCEPTION 'Payment not available'; END IF;
  SELECT * INTO n FROM invoices WHERE id=p_new_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF n.customer_id<>p.customer_id THEN RAISE EXCEPTION 'Target invoice must belong to the same customer (reverse and re-post for a different customer)'; END IF;
  IF n.id=p.invoice_id THEN RAISE EXCEPTION 'Same invoice'; END IF;
  IF p.amount > n.balance THEN RAISE EXCEPTION 'Payment (%) exceeds target invoice balance (%)', p.amount, n.balance; END IF;
  UPDATE invoices SET paid_amount=GREATEST(0,paid_amount-p.amount), balance=balance+p.amount,
    status=CASE WHEN paid_amount-p.amount<=0 THEN 'unpaid'::invoice_status ELSE 'partial'::invoice_status END WHERE id=p.invoice_id;
  UPDATE invoices SET paid_amount=paid_amount+p.amount, balance=balance-p.amount,
    status=CASE WHEN balance-p.amount<=0 THEN 'paid'::invoice_status ELSE 'partial'::invoice_status END WHERE id=n.id;
  INSERT INTO payment_corrections(correction_no,kind,payment_id,invoice_id,new_invoice_id,customer_id,reason_code,reason,amount,original_date,original_period_status,created_by)
  VALUES (next_correction_no(),'reallocation',p.id,p.invoice_id,n.id,p.customer_id,p_reason_code,p_reason,p.amount,p.payment_date::date,period_status_for(p.payment_date::date),auth.uid())
  RETURNING id INTO v_id;
  UPDATE payments SET invoice_id=n.id WHERE id=p.id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.write_off_bad_debt(p_invoice_id uuid, p_amount numeric, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; v_j uuid; v_id uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF COALESCE(trim(p_reason),'')='' THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO i FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF p_amount<=0 OR p_amount>i.balance THEN RAISE EXCEPTION 'Amount must be between 0 and the invoice balance'; END IF;
  v_j := post_journal('bad_debt', i.id, 'Bad debt write-off '||i.invoice_number||': '||p_reason,
    jsonb_build_array(jsonb_build_object('account','6900','debit',p_amount),jsonb_build_object('account','1100','credit',p_amount)), CURRENT_DATE);
  UPDATE invoices SET balance=balance-p_amount, status=CASE WHEN balance-p_amount<=0 THEN 'paid'::invoice_status ELSE status END WHERE id=i.id;
  UPDATE customers SET current_balance=GREATEST(0,current_balance-p_amount) WHERE id=i.customer_id;
  INSERT INTO payment_corrections(correction_no,kind,invoice_id,customer_id,reason_code,reason,amount,journal_id,created_by)
  VALUES (next_correction_no(),'write_off',i.id,i.customer_id,'bad_debt',p_reason,p_amount,v_j,auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_accounting_period(int,int,text,text), public.reverse_payment(uuid,text,text), public.correct_payment_account(uuid,text,text,numeric,text,text), public.reallocate_payment(uuid,uuid,text,text), public.write_off_bad_debt(uuid,numeric,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_accounting_period(int,int,text,text), public.reverse_payment(uuid,text,text), public.correct_payment_account(uuid,text,text,numeric,text,text), public.reallocate_payment(uuid,uuid,text,text), public.write_off_bad_debt(uuid,numeric,text) TO authenticated;