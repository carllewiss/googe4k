
-- Create enums
CREATE TYPE public.product_category AS ENUM ('Phone Accessories', 'Internet Services', 'Printing Services', 'Other Services');
CREATE TYPE public.payment_method AS ENUM ('cash', 'mpesa', 'cash_mpesa', 'partial_debt');
CREATE TYPE public.invoice_status AS ENUM ('paid', 'partial', 'unpaid');
CREATE TYPE public.customer_type AS ENUM ('walk_in', 'regular');

-- Suppliers
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  kra_pin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Products (catalog only, no stock qty here — that comes from batches)
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category product_category NOT NULL DEFAULT 'Phone Accessories',
  base_sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  floor_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  min_stock INTEGER NOT NULL DEFAULT 0,
  is_service BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Customer code sequence
CREATE SEQUENCE public.customer_code_seq START 1;

-- Customers
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT NOT NULL DEFAULT ('4K-CUST-' || LPAD(nextval('customer_code_seq')::TEXT, 3, '0')),
  name TEXT NOT NULL,
  phone TEXT,
  kra_pin TEXT,
  customer_type customer_type NOT NULL DEFAULT 'regular',
  debt_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Stock Batches (FIFO tracking)
CREATE TABLE public.stock_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  quantity_bought INTEGER NOT NULL DEFAULT 0,
  quantity_remaining INTEGER NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;

-- Purchase code sequence
CREATE SEQUENCE public.purchase_code_seq START 1;

-- Purchases
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_code TEXT NOT NULL DEFAULT ('PUR-' || LPAD(nextval('purchase_code_seq')::TEXT, 3, '0')),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Purchase Items
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.stock_batches(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Invoice number sequence
CREATE SEQUENCE public.invoice_number_seq START 1;

-- Invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL DEFAULT ('INV-' || LPAD(nextval('invoice_number_seq')::TEXT, 4, '0')),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mpesa_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'unpaid',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoice Items
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  batch_id UUID REFERENCES public.stock_batches(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  cogs NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Payments (individual payments against invoices)
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  amount NUMERIC(12,2) NOT NULL,
  cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mpesa_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Expenses
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Update triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- Suppliers: Admin full, agents can view
CREATE POLICY "admin_full_suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_suppliers" ON public.suppliers FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));

-- Products: Admin full, agents can view
CREATE POLICY "admin_full_products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_products" ON public.products FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));

-- Customers: Admin full, agents can view/create/update
CREATE POLICY "admin_full_customers" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_customers" ON public.customers FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_create_customers" ON public.customers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_update_customers" ON public.customers FOR UPDATE USING (public.has_role(auth.uid(), 'sales_agent'));

-- Stock Batches: Admin full, agents can view (no cost visibility enforced at app layer)
CREATE POLICY "admin_full_batches" ON public.stock_batches FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_batches" ON public.stock_batches FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));

-- Purchases: Admin only
CREATE POLICY "admin_full_purchases" ON public.purchases FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_full_purchase_items" ON public.purchase_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Invoices: Admin full, agents can view and create
CREATE POLICY "admin_full_invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_invoices" ON public.invoices FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_create_invoices" ON public.invoices FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_update_invoices" ON public.invoices FOR UPDATE USING (public.has_role(auth.uid(), 'sales_agent'));

-- Invoice Items: Admin full, agents can view and create
CREATE POLICY "admin_full_invoice_items" ON public.invoice_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_invoice_items" ON public.invoice_items FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_create_invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'sales_agent'));

-- Payments: Admin full, agents can view and create
CREATE POLICY "admin_full_payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents_view_payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY "agents_create_payments" ON public.payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'sales_agent'));

-- Expenses: Admin only
CREATE POLICY "admin_full_expenses" ON public.expenses FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============ FIFO COGS FUNCTION ============
-- This function deducts stock from oldest batches first and returns total COGS
CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(p_product_id UUID, p_quantity INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch RECORD;
  remaining INTEGER := p_quantity;
  total_cogs NUMERIC := 0;
  deduct INTEGER;
BEGIN
  FOR batch IN
    SELECT id, quantity_remaining, cost_price
    FROM public.stock_batches
    WHERE product_id = p_product_id AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    IF remaining <= 0 THEN EXIT; END IF;
    deduct := LEAST(remaining, batch.quantity_remaining);
    total_cogs := total_cogs + (deduct * batch.cost_price);
    UPDATE public.stock_batches SET quantity_remaining = quantity_remaining - deduct WHERE id = batch.id;
    remaining := remaining - deduct;
  END LOOP;
  RETURN total_cogs;
END;
$$;

-- Function to get current stock for a product (sum of remaining batches)
CREATE OR REPLACE FUNCTION public.get_product_stock(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity_remaining)::INTEGER, 0)
  FROM public.stock_batches
  WHERE product_id = p_product_id;
$$;
