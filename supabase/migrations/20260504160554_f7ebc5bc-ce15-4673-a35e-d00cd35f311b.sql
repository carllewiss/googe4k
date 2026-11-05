
-- Tables
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20) UNIQUE NOT NULL,
  name text NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id uuid REFERENCES public.accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_admin_all ON public.accounts FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY accounts_agent_read ON public.accounts FOR SELECT USING (has_role(auth.uid(),'sales_agent'));

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_type varchar(50),
  reference_id uuid,
  description text,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_reversal boolean NOT NULL DEFAULT false,
  reverses_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS idx_je_ref ON public.journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_je_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_jl_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jl_journal ON public.journal_lines(journal_id);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY je_admin_all ON public.journal_entries FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY je_agent_read ON public.journal_entries FOR SELECT USING (has_role(auth.uid(),'sales_agent'));
CREATE POLICY jl_admin_all ON public.journal_lines FOR ALL USING (has_role(auth.uid(),'admin'));
CREATE POLICY jl_agent_read ON public.journal_lines FOR SELECT USING (has_role(auth.uid(),'sales_agent'));

CREATE OR REPLACE FUNCTION public.journal_audit_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Journals are immutable. Post a reversal entry instead.'; END; $$;
CREATE TRIGGER trg_jl_no_update BEFORE UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.journal_audit_lock();
CREATE TRIGGER trg_jl_no_delete BEFORE DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.journal_audit_lock();
CREATE TRIGGER trg_je_no_update BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.journal_audit_lock();
CREATE TRIGGER trg_je_no_delete BEFORE DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.journal_audit_lock();

-- COA seed
INSERT INTO public.accounts (code, name, type) VALUES
('1000','Cash on Hand','asset'),('1010','Bank Account - KCB','asset'),('1020','Bank Account - Equity','asset'),
('1030','M-Pesa Till','asset'),('1040','M-Pesa Paybill','asset'),('1050','Petty Cash','asset'),
('1100','Accounts Receivable (Debtors)','asset'),('1200','Inventory','asset'),
('1300','Input VAT (Recoverable)','asset'),('1310','Prepaid Expenses','asset'),
('1500','Furniture & Fittings','asset'),('1510','Computers & Equipment','asset'),
('1520','Motor Vehicles','asset'),('1600','Accumulated Depreciation','asset'),
('2000','Accounts Payable (Suppliers)','liability'),('2100','VAT Payable (Output VAT)','liability'),
('2200','PAYE Payable','liability'),('2210','NHIF Payable','liability'),('2220','NSSF Payable','liability'),
('2300','Accrued Expenses','liability'),('2400','Customer Deposits','liability'),
('2500','Suspense Account','liability'),('2600','Bank Loans','liability'),('2610','Director Loan','liability'),
('3000','Owner Capital','equity'),('3100','Retained Earnings','equity'),
('3200','Current Year Profit','equity'),('3300','Drawings','equity'),
('4000','Sales Revenue','income'),('4010','Service Revenue','income'),('4020','Other Income','income'),
('4100','Discount Received','income'),('4200','Commission Income','income'),
('5000','Cost of Goods Sold','expense'),('5030','Freight Inwards','expense'),
('6000','Salaries & Wages','expense'),('6010','Rent Expense','expense'),
('6020','Electricity & Water','expense'),('6030','Internet & Communication','expense'),
('6040','Office Expenses','expense'),('6050','Transport & Fuel','expense'),
('6060','Repairs & Maintenance','expense'),('6070','Insurance Expense','expense'),
('6080','Security Expense','expense'),('6100','Advertising & Marketing','expense'),
('6110','Sales Commissions','expense'),('6120','Delivery Expense','expense'),
('6900','Other Expenses','expense'),('7000','Bank Charges','expense'),
('7010','Loan Interest','expense'),('7020','M-Pesa Charges','expense')
ON CONFLICT (code) DO NOTHING;

-- Posting RPC with auto-balance to Suspense for legacy/inconsistent data
CREATE OR REPLACE FUNCTION public.post_journal(
  p_reference_type text, p_reference_id uuid, p_description text,
  p_lines jsonb, p_entry_date date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_journal_id uuid; v_total_debit numeric := 0; v_total_credit numeric := 0;
  v_elem jsonb; v_account_id uuid; v_debit numeric; v_credit numeric;
  v_diff numeric; v_lines jsonb := p_lines;
BEGIN
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    v_total_debit := v_total_debit + COALESCE((v_elem->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_elem->>'credit')::numeric, 0);
  END LOOP;

  v_diff := round(v_total_debit, 2) - round(v_total_credit, 2);
  -- Auto-balance any difference to Suspense (covers rounding + legacy bad data)
  IF v_diff <> 0 THEN
    IF v_diff > 0 THEN
      v_lines := v_lines || jsonb_build_object('account','2500','credit', v_diff, 'memo','Auto-balanced to suspense');
      v_total_credit := v_total_credit + v_diff;
    ELSE
      v_lines := v_lines || jsonb_build_object('account','2500','debit', abs(v_diff), 'memo','Auto-balanced to suspense');
      v_total_debit := v_total_debit + abs(v_diff);
    END IF;
  END IF;

  IF v_total_debit = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.journal_entries(entry_date, reference_type, reference_id, description, total_amount, created_by)
  VALUES (p_entry_date, p_reference_type, p_reference_id, p_description, v_total_debit, auth.uid())
  RETURNING id INTO v_journal_id;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
    SELECT id INTO v_account_id FROM public.accounts WHERE code = (v_elem->>'account');
    IF v_account_id IS NULL THEN RAISE EXCEPTION 'Account code % not found', v_elem->>'account'; END IF;
    v_debit := COALESCE((v_elem->>'debit')::numeric, 0);
    v_credit := COALESCE((v_elem->>'credit')::numeric, 0);
    IF v_debit = 0 AND v_credit = 0 THEN CONTINUE; END IF;
    INSERT INTO public.journal_lines(journal_id, account_id, debit, credit, memo)
    VALUES (v_journal_id, v_account_id, v_debit, v_credit, v_elem->>'memo');
  END LOOP;
  RETURN v_journal_id;
END; $$;

CREATE OR REPLACE FUNCTION public.invoice_net(p_subtotal numeric, p_total numeric, p_tax numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(p_subtotal,0) > 0 THEN p_subtotal
              ELSE COALESCE(p_total,0) - COALESCE(p_tax,0) END;
$$;

-- Triggers
CREATE OR REPLACE FUNCTION public.post_invoice_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lines jsonb := '[]'::jsonb; v_net numeric;
  v_paid numeric := COALESCE(NEW.paid_amount, 0);
  v_balance numeric := COALESCE(NEW.balance, 0);
  v_cash numeric := COALESCE(NEW.cash_amount, 0);
  v_mpesa numeric := COALESCE(NEW.mpesa_amount, 0);
  v_diff numeric;
BEGIN
  v_net := public.invoice_net(NEW.subtotal, NEW.total, NEW.tax);
  IF v_balance > 0 THEN v_lines := v_lines || jsonb_build_object('account','1100','debit',v_balance); END IF;
  IF v_cash > 0 THEN v_lines := v_lines || jsonb_build_object('account','1000','debit',v_cash); END IF;
  IF v_mpesa > 0 THEN v_lines := v_lines || jsonb_build_object('account','1030','debit',v_mpesa); END IF;
  v_diff := v_paid - v_cash - v_mpesa;
  IF v_diff > 0 THEN v_lines := v_lines || jsonb_build_object('account','1000','debit',v_diff); END IF;
  IF v_net > 0 THEN v_lines := v_lines || jsonb_build_object('account','4000','credit',v_net); END IF;
  IF COALESCE(NEW.tax,0) > 0 THEN v_lines := v_lines || jsonb_build_object('account','2100','credit',NEW.tax); END IF;
  PERFORM public.post_journal('invoice', NEW.id, 'Invoice ' || NEW.invoice_number, v_lines, NEW.created_at::date);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoice_post AFTER INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.post_invoice_journal();

CREATE OR REPLACE FUNCTION public.post_invoice_item_cogs() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv_date date;
BEGIN
  IF COALESCE(NEW.cogs, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT created_at::date INTO v_inv_date FROM public.invoices WHERE id = NEW.invoice_id;
  PERFORM public.post_journal('cogs', NEW.id, 'COGS for invoice item',
    jsonb_build_array(jsonb_build_object('account','5000','debit',NEW.cogs),
                      jsonb_build_object('account','1200','credit',NEW.cogs)),
    COALESCE(v_inv_date, CURRENT_DATE));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoice_item_cogs AFTER INSERT ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.post_invoice_item_cogs();

CREATE OR REPLACE FUNCTION public.post_payment_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lines jsonb := '[]'::jsonb;
  v_cash numeric := COALESCE(NEW.cash_amount, 0);
  v_mpesa numeric := COALESCE(NEW.mpesa_amount, 0);
  v_amt numeric := COALESCE(NEW.amount, 0);
  v_diff numeric;
BEGIN
  IF v_amt = 0 THEN RETURN NEW; END IF;
  IF v_cash <> 0 THEN
    v_lines := v_lines || (CASE WHEN v_cash>0 THEN jsonb_build_object('account','1000','debit',v_cash)
                                ELSE jsonb_build_object('account','1000','credit',abs(v_cash)) END);
  END IF;
  IF v_mpesa <> 0 THEN
    v_lines := v_lines || (CASE WHEN v_mpesa>0 THEN jsonb_build_object('account','1030','debit',v_mpesa)
                                ELSE jsonb_build_object('account','1030','credit',abs(v_mpesa)) END);
  END IF;
  v_diff := v_amt - v_cash - v_mpesa;
  IF v_diff <> 0 THEN
    v_lines := v_lines || (CASE WHEN v_diff>0 THEN jsonb_build_object('account','1000','debit',v_diff)
                                ELSE jsonb_build_object('account','1000','credit',abs(v_diff)) END);
  END IF;
  v_lines := v_lines || (CASE WHEN v_amt>0 THEN jsonb_build_object('account','1100','credit',v_amt)
                              ELSE jsonb_build_object('account','1100','debit',abs(v_amt)) END);
  PERFORM public.post_journal('payment', NEW.id,
    CASE WHEN v_amt<0 THEN 'Refund' ELSE 'Customer Payment' END, v_lines, NEW.payment_date::date);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payment_post AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.post_payment_journal();

CREATE OR REPLACE FUNCTION public.post_purchase_item_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pdate date;
BEGIN
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT purchase_date INTO v_pdate FROM public.purchases WHERE id = NEW.purchase_id;
  PERFORM public.post_journal('purchase_item', NEW.id, 'Stock purchase',
    jsonb_build_array(jsonb_build_object('account','1200','debit',NEW.total),
                      jsonb_build_object('account','2000','credit',NEW.total)),
    COALESCE(v_pdate, CURRENT_DATE));
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_purchase_item_post AFTER INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.post_purchase_item_journal();

-- Expense table upgrade
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS journal_id uuid REFERENCES public.journal_entries(id);

CREATE OR REPLACE FUNCTION public.map_expense_category_to_account(p_cat text) RETURNS uuid
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT id FROM public.accounts WHERE code = (
    CASE lower(coalesce(p_cat,''))
      WHEN 'electricity' THEN '6020' WHEN 'rent' THEN '6010' WHEN 'internet' THEN '6030'
      WHEN 'stock purchase' THEN '5030' WHEN 'transport' THEN '6050' WHEN 'salary' THEN '6000'
      WHEN 'marketing' THEN '6100' WHEN 'maintenance' THEN '6060' ELSE '6900'
    END) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.post_expense_journal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acct_code text; v_pay_code text; v_journal uuid; v_lines jsonb; v_net numeric;
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    SELECT code INTO v_acct_code FROM public.accounts WHERE id = NEW.account_id;
  ELSE
    SELECT code INTO v_acct_code FROM public.accounts WHERE id = public.map_expense_category_to_account(NEW.category);
  END IF;
  IF NEW.payment_account_id IS NOT NULL THEN
    SELECT code INTO v_pay_code FROM public.accounts WHERE id = NEW.payment_account_id;
  ELSE
    v_pay_code := '1000';
  END IF;
  v_net := NEW.amount - COALESCE(NEW.vat_amount, 0);
  v_lines := jsonb_build_array(jsonb_build_object('account', v_acct_code, 'debit', v_net));
  IF COALESCE(NEW.vat_amount,0) > 0 THEN
    v_lines := v_lines || jsonb_build_object('account','1300','debit', NEW.vat_amount);
  END IF;
  v_lines := v_lines || jsonb_build_object('account', v_pay_code, 'credit', NEW.amount);
  v_journal := public.post_journal('expense', NEW.id, COALESCE(NEW.description, NEW.category), v_lines, NEW.expense_date);
  NEW.journal_id := v_journal;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_expense_post BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.post_expense_journal();

-- Credit note posting
CREATE OR REPLACE FUNCTION public.post_credit_note_journal(p_cn_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cn RECORD; v_cogs numeric; v_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_cn FROM public.credit_notes WHERE id = p_cn_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_cn.subtotal > 0 THEN v_lines := v_lines || jsonb_build_object('account','4000','debit',v_cn.subtotal); END IF;
  IF v_cn.tax > 0 THEN v_lines := v_lines || jsonb_build_object('account','2100','debit',v_cn.tax); END IF;
  IF v_cn.subtotal = 0 AND v_cn.tax = 0 AND v_cn.total > 0 THEN
    v_lines := v_lines || jsonb_build_object('account','4000','debit',v_cn.total);
  END IF;

  IF v_cn.refund_method = 'cash_refund' THEN
    IF v_cn.refund_amount > 0 THEN v_lines := v_lines || jsonb_build_object('account','1000','credit',v_cn.refund_amount); END IF;
    IF v_cn.total > v_cn.refund_amount THEN v_lines := v_lines || jsonb_build_object('account','1100','credit', v_cn.total - v_cn.refund_amount); END IF;
  ELSIF v_cn.refund_method = 'mpesa_refund' THEN
    IF v_cn.refund_amount > 0 THEN v_lines := v_lines || jsonb_build_object('account','1030','credit',v_cn.refund_amount); END IF;
    IF v_cn.total > v_cn.refund_amount THEN v_lines := v_lines || jsonb_build_object('account','1100','credit', v_cn.total - v_cn.refund_amount); END IF;
  ELSIF v_cn.refund_method = 'credit_balance' THEN
    IF v_cn.refund_amount > 0 THEN v_lines := v_lines || jsonb_build_object('account','2400','credit',v_cn.refund_amount); END IF;
    IF v_cn.total > v_cn.refund_amount THEN v_lines := v_lines || jsonb_build_object('account','1100','credit', v_cn.total - v_cn.refund_amount); END IF;
  ELSE
    v_lines := v_lines || jsonb_build_object('account','1100','credit',v_cn.total);
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN cni.is_service THEN 0
    ELSE (SELECT CASE WHEN ii.quantity > 0 THEN (ii.cogs / ii.quantity) * cni.quantity ELSE 0 END
          FROM public.invoice_items ii WHERE ii.id = cni.invoice_item_id) END
  ), 0) INTO v_cogs FROM public.credit_note_items cni WHERE cni.credit_note_id = p_cn_id;

  IF v_cogs > 0 THEN
    PERFORM public.post_journal('credit_note_cogs', p_cn_id, 'CN ' || v_cn.credit_note_number || ' stock restore',
      jsonb_build_array(jsonb_build_object('account','1200','debit',v_cogs),
                        jsonb_build_object('account','5000','credit',v_cogs)));
  END IF;

  RETURN public.post_journal('credit_note', p_cn_id, 'Credit Note ' || v_cn.credit_note_number, v_lines, v_cn.created_at::date);
END; $$;

CREATE OR REPLACE FUNCTION public.create_credit_note(p_invoice_id uuid, p_reason text, p_refund_method credit_note_refund_method, p_items jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_cn_id uuid; v_invoice RECORD; v_li RECORD; v_elem jsonb; v_req_qty integer;
  v_line_total numeric; v_subtotal numeric := 0; v_tax_total numeric := 0; v_total numeric := 0;
  v_line_tax numeric; v_unit_cost numeric; v_batch_id uuid; v_refund_amount numeric;
  v_new_paid numeric; v_new_balance numeric; v_new_status invoice_status;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  INSERT INTO public.credit_notes(invoice_id, customer_id, reason, refund_method, created_by)
  VALUES (p_invoice_id, v_invoice.customer_id, p_reason, p_refund_method, auth.uid()) RETURNING id INTO v_cn_id;
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_req_qty := (v_elem->>'quantity')::int;
    IF v_req_qty IS NULL OR v_req_qty <= 0 THEN CONTINUE; END IF;
    SELECT ii.id AS invoice_item_id, ii.product_id, ii.quantity AS sold_qty, ii.unit_price, ii.cogs,
           p.is_service, p.name AS product_name, p.tax_category, p.vat_rate INTO v_li
    FROM public.invoice_items ii JOIN public.products p ON p.id = ii.product_id
    WHERE ii.id = (v_elem->>'invoice_item_id')::uuid AND ii.invoice_id = p_invoice_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice item % not found', (v_elem->>'invoice_item_id'); END IF;
    v_line_total := v_li.unit_price * v_req_qty;
    v_line_tax := 0;
    IF v_li.tax_category::text = 'standard' AND COALESCE(v_li.vat_rate,0) > 0 THEN
      v_line_tax := v_line_total - (v_line_total / (1 + v_li.vat_rate / 100.0));
    END IF;
    v_subtotal := v_subtotal + (v_line_total - v_line_tax);
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;
    v_batch_id := NULL;
    IF NOT v_li.is_service THEN
      v_unit_cost := CASE WHEN v_li.sold_qty > 0 THEN COALESCE(v_li.cogs,0) / v_li.sold_qty ELSE 0 END;
      INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
      VALUES (v_li.product_id, v_req_qty, v_req_qty, v_unit_cost, CURRENT_DATE) RETURNING id INTO v_batch_id;
    END IF;
    INSERT INTO public.credit_note_items(credit_note_id, invoice_item_id, product_id, product_name, is_service,
      quantity, unit_price, total, restored_to_stock, restore_batch_id)
    VALUES (v_cn_id, v_li.invoice_item_id, v_li.product_id, v_li.product_name, v_li.is_service,
      v_req_qty, v_li.unit_price, v_line_total, NOT v_li.is_service, v_batch_id);
  END LOOP;
  IF v_total <= 0 THEN RAISE EXCEPTION 'Credit note total must be greater than zero'; END IF;
  v_refund_amount := 0;
  IF p_refund_method IN ('cash_refund','mpesa_refund','credit_balance') THEN
    v_refund_amount := LEAST(v_total, v_invoice.paid_amount);
  END IF;
  UPDATE public.credit_notes SET subtotal=v_subtotal, tax=v_tax_total, total=v_total, refund_amount=v_refund_amount WHERE id=v_cn_id;
  v_new_paid := GREATEST(v_invoice.paid_amount - v_refund_amount, 0);
  v_new_balance := GREATEST((v_invoice.total - v_total) - v_new_paid, 0);
  IF (v_invoice.total - v_total) <= 0 OR v_new_balance <= 0 THEN v_new_status := 'paid'::invoice_status;
  ELSIF v_new_paid > 0 THEN v_new_status := 'partial'::invoice_status;
  ELSE v_new_status := 'unpaid'::invoice_status; END IF;
  UPDATE public.invoices SET total = GREATEST(total - v_total,0), subtotal = GREATEST(subtotal - v_subtotal,0),
    tax = GREATEST(tax - v_tax_total,0), paid_amount = v_new_paid, balance = v_new_balance, status = v_new_status
    WHERE id = p_invoice_id;
  IF p_refund_method = 'credit_balance' THEN
    UPDATE public.customers SET current_balance = current_balance - v_refund_amount,
      total_spent = GREATEST(total_spent - v_refund_amount, 0) WHERE id = v_invoice.customer_id;
  ELSIF p_refund_method IN ('cash_refund','mpesa_refund') THEN
    UPDATE public.customers SET total_spent = GREATEST(total_spent - v_refund_amount, 0) WHERE id = v_invoice.customer_id;
    INSERT INTO public.payments(invoice_id, customer_id, amount, cash_amount, mpesa_amount, notes, created_by)
    VALUES (p_invoice_id, v_invoice.customer_id, -v_refund_amount,
      CASE WHEN p_refund_method='cash_refund' THEN -v_refund_amount ELSE 0 END,
      CASE WHEN p_refund_method='mpesa_refund' THEN -v_refund_amount ELSE 0 END,
      'Refund for credit note', auth.uid());
  ELSE
    UPDATE public.customers SET current_balance = GREATEST(current_balance - (v_total - v_refund_amount), 0)
      WHERE id = v_invoice.customer_id;
  END IF;
  PERFORM public.post_credit_note_journal(v_cn_id);
  RETURN v_cn_id;
END; $function$;

-- BACKFILL
DO $backfill$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT pi.* FROM public.purchase_items pi ORDER BY pi.created_at LOOP
    DECLARE v_pdate date;
    BEGIN
      SELECT purchase_date INTO v_pdate FROM public.purchases WHERE id = r.purchase_id;
      IF COALESCE(r.total,0) > 0 THEN
        PERFORM public.post_journal('purchase_item', r.id, 'Backfill: stock purchase',
          jsonb_build_array(jsonb_build_object('account','1200','debit',r.total),
                            jsonb_build_object('account','2000','credit',r.total)),
          COALESCE(v_pdate, r.created_at::date));
      END IF;
    END;
  END LOOP;

  FOR r IN SELECT * FROM public.invoices ORDER BY created_at LOOP
    DECLARE
      v_lines jsonb := '[]'::jsonb; v_net numeric;
      v_paid numeric := COALESCE(r.paid_amount,0);
      v_balance numeric := COALESCE(r.balance,0);
      v_cash numeric := COALESCE(r.cash_amount,0);
      v_mpesa numeric := COALESCE(r.mpesa_amount,0);
      v_diff numeric;
    BEGIN
      v_net := public.invoice_net(r.subtotal, r.total, r.tax);
      IF v_balance > 0 THEN v_lines := v_lines || jsonb_build_object('account','1100','debit',v_balance); END IF;
      IF v_cash > 0 THEN v_lines := v_lines || jsonb_build_object('account','1000','debit',v_cash); END IF;
      IF v_mpesa > 0 THEN v_lines := v_lines || jsonb_build_object('account','1030','debit',v_mpesa); END IF;
      v_diff := v_paid - v_cash - v_mpesa;
      IF v_diff > 0 THEN v_lines := v_lines || jsonb_build_object('account','1000','debit',v_diff); END IF;
      IF v_net > 0 THEN v_lines := v_lines || jsonb_build_object('account','4000','credit',v_net); END IF;
      IF COALESCE(r.tax,0) > 0 THEN v_lines := v_lines || jsonb_build_object('account','2100','credit',r.tax); END IF;
      PERFORM public.post_journal('invoice', r.id, 'Backfill: Invoice ' || r.invoice_number, v_lines, r.created_at::date);
    END;
  END LOOP;

  FOR r IN SELECT ii.*, i.created_at AS inv_date FROM public.invoice_items ii
           JOIN public.invoices i ON i.id = ii.invoice_id ORDER BY ii.created_at LOOP
    IF COALESCE(r.cogs,0) > 0 THEN
      PERFORM public.post_journal('cogs', r.id, 'Backfill: COGS',
        jsonb_build_array(jsonb_build_object('account','5000','debit',r.cogs),
                          jsonb_build_object('account','1200','credit',r.cogs)),
        r.inv_date::date);
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM public.payments ORDER BY created_at LOOP
    DECLARE
      v_lines jsonb := '[]'::jsonb;
      v_cash numeric := COALESCE(r.cash_amount,0);
      v_mpesa numeric := COALESCE(r.mpesa_amount,0);
      v_amt numeric := COALESCE(r.amount,0);
      v_diff numeric;
    BEGIN
      IF v_amt = 0 THEN CONTINUE; END IF;
      IF v_cash <> 0 THEN
        v_lines := v_lines || (CASE WHEN v_cash>0 THEN jsonb_build_object('account','1000','debit',v_cash)
                                    ELSE jsonb_build_object('account','1000','credit',abs(v_cash)) END);
      END IF;
      IF v_mpesa <> 0 THEN
        v_lines := v_lines || (CASE WHEN v_mpesa>0 THEN jsonb_build_object('account','1030','debit',v_mpesa)
                                    ELSE jsonb_build_object('account','1030','credit',abs(v_mpesa)) END);
      END IF;
      v_diff := v_amt - v_cash - v_mpesa;
      IF v_diff <> 0 THEN
        v_lines := v_lines || (CASE WHEN v_diff>0 THEN jsonb_build_object('account','1000','debit',v_diff)
                                    ELSE jsonb_build_object('account','1000','credit',abs(v_diff)) END);
      END IF;
      v_lines := v_lines || (CASE WHEN v_amt>0 THEN jsonb_build_object('account','1100','credit',v_amt)
                                  ELSE jsonb_build_object('account','1100','debit',abs(v_amt)) END);
      PERFORM public.post_journal('payment', r.id,
        CASE WHEN v_amt<0 THEN 'Backfill: Refund' ELSE 'Backfill: Payment' END, v_lines, r.payment_date::date);
    END;
  END LOOP;

  FOR r IN SELECT * FROM public.expenses ORDER BY created_at LOOP
    DECLARE
      v_acct text; v_pay text; v_net numeric; v_lines jsonb;
    BEGIN
      SELECT code INTO v_acct FROM public.accounts WHERE id = public.map_expense_category_to_account(r.category);
      v_pay := '1000';
      v_net := r.amount - COALESCE(r.vat_amount,0);
      v_lines := jsonb_build_array(jsonb_build_object('account', v_acct, 'debit', v_net));
      IF COALESCE(r.vat_amount,0) > 0 THEN
        v_lines := v_lines || jsonb_build_object('account','1300','debit', r.vat_amount);
      END IF;
      v_lines := v_lines || jsonb_build_object('account', v_pay, 'credit', r.amount);
      PERFORM public.post_journal('expense', r.id, COALESCE(r.description, r.category), v_lines, r.expense_date);
    END;
  END LOOP;

  FOR r IN SELECT id FROM public.credit_notes ORDER BY created_at LOOP
    PERFORM public.post_credit_note_journal(r.id);
  END LOOP;
END;
$backfill$;

CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT a.id AS account_id, a.code, a.name, a.type,
  COALESCE(SUM(jl.debit),0) AS total_debit,
  COALESCE(SUM(jl.credit),0) AS total_credit,
  COALESCE(SUM(jl.debit - jl.credit),0) AS balance
FROM public.accounts a
LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;
