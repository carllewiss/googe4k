-- ============================================================================
-- 4K Smart Solutions ERP - Complete Master Database Migration
-- Generated from 37 sequential migrations in /supabase/migrations
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- Target Project: https://jeujndewidagwrmmanxr.supabase.co
-- ============================================================================

-- >>> Migration: 20260414175235_6f7f00bf-081b-435f-b827-63f8be2c8f0f.sql <<<

-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales_agent');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- >>> Migration: 20260415063802_5fb0e220-b780-49ec-9ba9-96864f2b0dc5.sql <<<

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


-- >>> Migration: 20260416154455_a3e767f5-6a4f-458b-8053-ad2d4816fbeb.sql <<<

-- Add credit terms to customers (days to pay)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_terms integer NOT NULL DEFAULT 30;

-- Create tax_category enum
DO $$ BEGIN
  CREATE TYPE public.tax_category AS ENUM ('standard', 'zero_rated', 'exempt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add tax_category to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_category public.tax_category NOT NULL DEFAULT 'standard';

-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_full_settings" ON public.system_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Agents can read settings (to check eTIMS status etc.)
CREATE POLICY "agents_view_settings" ON public.system_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'sales_agent'));

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('etims_enabled', 'false', 'Global toggle for KRA eTIMS tax compliance mode'),
  ('default_tax_rate', '16', 'Default VAT rate percentage for standard-rated items'),
  ('business_name', '4K Smart Solutions Ltd', 'Business name shown on invoices')
ON CONFLICT (key) DO NOTHING;


-- >>> Migration: 20260417120037_184039da-8fed-4efa-a318-af00d4448de2.sql <<<
-- Customer notes for the Customer 360 view
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_notes_customer_id ON public.customer_notes(customer_id);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

-- Admins: full control
CREATE POLICY "admin_full_customer_notes"
  ON public.customer_notes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Sales agents: read + insert only
CREATE POLICY "agents_view_customer_notes"
  ON public.customer_notes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'sales_agent'::app_role));

CREATE POLICY "agents_create_customer_notes"
  ON public.customer_notes
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'sales_agent'::app_role));

-- Trigger for updated_at
CREATE TRIGGER trg_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- >>> Migration: 20260417120107_7fd0852a-69f4-4622-b68a-28ba1d79eec2.sql <<<
-- eTIMS status enum
CREATE TYPE public.etims_status AS ENUM ('not_required', 'pending_sync', 'signed', 'failed');

-- Invoice eTIMS columns
ALTER TABLE public.invoices
  ADD COLUMN etims_status public.etims_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN etims_signature TEXT,
  ADD COLUMN etims_qr_data TEXT,
  ADD COLUMN etims_synced_at TIMESTAMPTZ,
  ADD COLUMN etims_error TEXT,
  ADD COLUMN reprint_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_reprinted_at TIMESTAMPTZ;

-- Seed default eTIMS settings rows (idempotent)
INSERT INTO public.system_settings (key, value, description)
VALUES
  ('etims_mode', 'sandbox', 'KRA eTIMS environment: sandbox or production'),
  ('etims_device_id', '', 'KRA-issued device ID / serial number'),
  ('etims_kra_pin', '', 'Business KRA PIN for eTIMS')
ON CONFLICT (key) DO NOTHING;

-- >>> Migration: 20260418121213_648bb58b-777d-4cca-8bf1-423c02c7839b.sql <<<
-- 1. Price history audit log
CREATE TABLE public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL CHECK (field_changed IN ('base_sell_price', 'floor_price')),
  old_value NUMERIC NOT NULL,
  new_value NUMERIC NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

CREATE INDEX idx_price_history_product ON public.price_history(product_id, changed_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_price_history"
  ON public.price_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies: only the trigger (security definer) writes here.

-- 2. Trigger function: logs sell-price + floor-price changes automatically
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.base_sell_price IS DISTINCT FROM OLD.base_sell_price THEN
    INSERT INTO public.price_history (product_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'base_sell_price', OLD.base_sell_price, NEW.base_sell_price, auth.uid());
  END IF;

  IF NEW.floor_price IS DISTINCT FROM OLD.floor_price THEN
    INSERT INTO public.price_history (product_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, 'floor_price', OLD.floor_price, NEW.floor_price, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_product_price_change
  AFTER UPDATE OF base_sell_price, floor_price ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_price_change();

-- >>> Migration: 20260418122509_3ad39198-6f12-4d85-a352-df7f8b86b9ca.sql <<<
-- Add per-product VAT override. NULL = use system default rate.
ALTER TABLE public.products
  ADD COLUMN vat_rate NUMERIC(5,2);

COMMENT ON COLUMN public.products.vat_rate IS 'Optional per-product VAT %. NULL means use system_settings.default_tax_rate. Only applies when tax_category = standard.';

-- Sanity check: 0..100
ALTER TABLE public.products
  ADD CONSTRAINT products_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

-- >>> Migration: 20260501170232_1a5a017a-dabf-41be-bd08-79983d6b9501.sql <<<
-- Prevent any stock_batches row from going negative
ALTER TABLE public.stock_batches
  DROP CONSTRAINT IF EXISTS stock_batches_quantity_remaining_nonneg;
ALTER TABLE public.stock_batches
  ADD CONSTRAINT stock_batches_quantity_remaining_nonneg
  CHECK (quantity_remaining >= 0);

-- Replace FIFO deduction: refuse to oversell, skip services
CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(p_product_id uuid, p_quantity integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  batch RECORD;
  remaining INTEGER := p_quantity;
  total_cogs NUMERIC := 0;
  deduct INTEGER;
  v_is_service BOOLEAN;
  v_available INTEGER;
  v_product_name TEXT;
BEGIN
  SELECT is_service, name INTO v_is_service, v_product_name
  FROM public.products WHERE id = p_product_id;

  -- Services: no stock tracking, no COGS deduction
  IF v_is_service THEN
    RETURN 0;
  END IF;

  -- Pre-flight: total available across batches
  SELECT COALESCE(SUM(quantity_remaining), 0)::INTEGER INTO v_available
  FROM public.stock_batches WHERE product_id = p_product_id;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: % has only % units available (requested %)',
      v_product_name, v_available, p_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  FOR batch IN
    SELECT id, quantity_remaining, cost_price
    FROM public.stock_batches
    WHERE product_id = p_product_id AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    IF remaining <= 0 THEN EXIT; END IF;
    deduct := LEAST(remaining, batch.quantity_remaining);
    total_cogs := total_cogs + (deduct * batch.cost_price);
    UPDATE public.stock_batches
      SET quantity_remaining = quantity_remaining - deduct
      WHERE id = batch.id;
    remaining := remaining - deduct;
  END LOOP;

  RETURN total_cogs;
END;
$function$;

-- >>> Migration: 20260502150938_fa5aec3a-7b09-4213-90c9-5c1a63eda74b.sql <<<
-- ============================================================================
-- SHOP + BLOG + SERVICES + PRODUCT IMAGES
-- ============================================================================

-- 1. PRODUCT IMAGES & SHOP VISIBILITY
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS shop_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_featured boolean NOT NULL DEFAULT false;

-- Public can view shop-visible products (no auth required for browsing catalog)
DROP POLICY IF EXISTS "public_view_shop_products" ON public.products;
CREATE POLICY "public_view_shop_products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (shop_visible = true);

-- 2. SHOP CUSTOMER ACCOUNTS (separate from staff profiles)
CREATE TABLE IF NOT EXISTS public.shop_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,                       -- nullable: guest checkouts allowed
  erp_customer_id uuid,                      -- link to customers table when invoiced
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_customer_self_select" ON public.shop_customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "shop_customer_self_insert" ON public.shop_customers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "shop_customer_self_update" ON public.shop_customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "shop_customer_admin_all" ON public.shop_customers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow guest insert (no auth) — needed for guest checkout
CREATE POLICY "shop_customer_guest_insert" ON public.shop_customers
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 3. SHOP ORDERS (pending until M-Pesa confirms)
CREATE TYPE shop_order_status AS ENUM ('pending', 'paid', 'failed', 'cancelled', 'fulfilled');

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('SHOP-' || lpad(nextval('invoice_number_seq')::text, 5, '0')),
  shop_customer_id uuid REFERENCES public.shop_customers(id),
  user_id uuid,                              -- buyer if logged in
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  delivery_address text,
  subtotal numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status shop_order_status NOT NULL DEFAULT 'pending',
  mpesa_checkout_request_id text,
  mpesa_receipt text,
  mpesa_phone text,
  invoice_id uuid,                           -- link to ERP invoice once paid
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or auth) can create an order (guest checkout)
CREATE POLICY "orders_create_any" ON public.shop_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "order_items_create_any" ON public.shop_order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Authenticated buyers see their own orders
CREATE POLICY "orders_select_own" ON public.shop_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_agent'));

CREATE POLICY "order_items_select_own" ON public.shop_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_orders o
      WHERE o.id = order_id
        AND (o.user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_agent'))
    )
  );

-- Admins fully manage
CREATE POLICY "orders_admin_all" ON public.shop_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "order_items_admin_all" ON public.shop_order_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. SERVICE INQUIRIES (WhatsApp leads)
CREATE TABLE IF NOT EXISTS public.service_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL,                 -- 'kra_pin', 'nssf', 'helb', etc
  service_name text NOT NULL,
  customer_name text,
  customer_phone text,
  user_id uuid,
  source text NOT NULL DEFAULT 'shop_click', -- shop_click, etc
  whatsapp_message text,
  status text NOT NULL DEFAULT 'new',        -- new, contacted, converted, closed
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiries_create_any" ON public.service_inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "inquiries_admin_all" ON public.service_inquiries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'sales_agent'));

-- 5. BLOG POSTS
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,  -- Tiptap JSON document
  cover_image_url text,
  author_id uuid,
  author_name text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_published ON public.blog_posts(published, published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public reads only published posts
CREATE POLICY "blog_public_read" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (published = true);

-- Admins manage all
CREATE POLICY "blog_admin_all" ON public.blog_posts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_shop_customers_updated BEFORE UPDATE ON public.shop_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shop_orders_updated BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_service_inquiries_updated BEFORE UPDATE ON public.service_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. STORAGE BUCKETS (public read for product/blog images)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-images', 'product-images', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('blog-images', 'blog-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Public read for both
CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Blog images public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blog-images');

-- Admins upload/manage
CREATE POLICY "Product images admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Product images admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Product images admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Blog images admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Blog images admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Blog images admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'blog-images' AND has_role(auth.uid(), 'admin'));

-- >>> Migration: 20260503082348_55fb1050-3491-49d7-899f-183718ea41a4.sql <<<

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


-- >>> Migration: 20260503082759_ae4bb217-8ffc-431b-980b-0699c87ef555.sql <<<

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


-- >>> Migration: 20260504160554_f7ebc5bc-ce15-4673-a35e-d00cd35f311b.sql <<<

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


-- >>> Migration: 20260504160613_5c034b90-7a3a-460b-9ed0-93267d4086e0.sql <<<

DROP VIEW IF EXISTS public.v_trial_balance;
CREATE VIEW public.v_trial_balance
WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.code, a.name, a.type,
  COALESCE(SUM(jl.debit),0) AS total_debit,
  COALESCE(SUM(jl.credit),0) AS total_credit,
  COALESCE(SUM(jl.debit - jl.credit),0) AS balance
FROM public.accounts a
LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.code;

REVOKE EXECUTE ON FUNCTION public.post_journal(text,uuid,text,jsonb,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.post_credit_note_journal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.map_expense_category_to_account(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.invoice_net(numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_journal(text,uuid,text,jsonb,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_credit_note_journal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_expense_category_to_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_net(numeric,numeric,numeric) TO authenticated;


-- >>> Migration: 20260505161307_b8fd03a4-34bb-4b77-84f9-d7f3593c75ef.sql <<<
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text;

-- >>> Migration: 20260509075457_6b79b880-baed-4c40-99ed-bdecb1eaaa13.sql <<<

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


-- >>> Migration: 20260606124024_10b717ec-b385-4e3b-b1a9-cc042dade5b8.sql <<<
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_reason text;

CREATE INDEX IF NOT EXISTS idx_invoices_approval_status ON public.invoices (approval_status);

-- >>> Migration: 20260607085431_8a2486f5-a110-4b0f-b226-46c4b70bb3b0.sql <<<
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active services"
  ON public.services FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Authenticated can view all services"
  ON public.services FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage services"
  ON public.services FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Public can read shop display settings"
  ON public.system_settings FOR SELECT TO anon
  USING (key IN ('adsense_client','adsense_slot_sidebar','adsense_slot_footer','adsense_slot_article','adsense_enabled'));

-- >>> Migration: 20260608163914_78437e87-7922-411e-92d1-d469a44a4e6d.sql <<<
-- Dedicated income account for WiFi / Internet captive-portal revenue
INSERT INTO public.accounts (code, name, type)
VALUES ('4020', 'WiFi / Internet Revenue', 'income')
ON CONFLICT (code) DO NOTHING;

-- ============ WiFi payment transactions synced from the captive portal ============
CREATE TABLE public.wifi_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remote_id uuid NOT NULL UNIQUE,
  phone_number text,
  amount numeric NOT NULL DEFAULT 0,
  package_type text,
  mpesa_receipt text,
  voucher_code text,
  status text NOT NULL DEFAULT 'success',
  paid_at timestamptz NOT NULL DEFAULT now(),
  authenticated_at timestamptz,
  client_mac text,
  ssid text,
  journal_id uuid,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wifi_transactions TO authenticated;
GRANT ALL ON public.wifi_transactions TO service_role;

ALTER TABLE public.wifi_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view wifi transactions"
ON public.wifi_transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wifi_tx_paid_at ON public.wifi_transactions (paid_at DESC);

-- ============ WiFi voucher assignments synced from the captive portal ============
CREATE TABLE public.wifi_vouchers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remote_id uuid NOT NULL UNIQUE,
  code text,
  package_type text,
  duration_hours integer,
  status text,
  used_by_mac text,
  used_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wifi_vouchers TO authenticated;
GRANT ALL ON public.wifi_vouchers TO service_role;

ALTER TABLE public.wifi_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view wifi vouchers"
ON public.wifi_vouchers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wifi_vouchers_used_at ON public.wifi_vouchers (used_at DESC);

-- ============ Auto-post each WiFi sale to the general ledger ============
-- Debit M-Pesa Till (1030), Credit WiFi / Internet Revenue (4020)
CREATE OR REPLACE FUNCTION public.post_wifi_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.amount, 0) > 0 AND NEW.status = 'success' THEN
    NEW.journal_id := public.post_journal(
      'wifi', NEW.id,
      'WiFi M-Pesa ' || COALESCE(NEW.mpesa_receipt, '') || ' (' || COALESCE(NEW.package_type,'') || ')',
      jsonb_build_array(
        jsonb_build_object('account','1030','debit', NEW.amount),
        jsonb_build_object('account','4020','credit', NEW.amount)
      ),
      NEW.paid_at::date
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_post_wifi_journal
BEFORE INSERT ON public.wifi_transactions
FOR EACH ROW EXECUTE FUNCTION public.post_wifi_journal();

-- >>> Migration: 20260608164314_f883ff82-d582-424a-84d8-fb29595e0b98.sql <<<
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- >>> Migration: 20260703162249_364d701d-50a0-4eef-af3d-a5cd1f0c2663.sql <<<
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON public.journal_entries (entry_date);

CREATE OR REPLACE FUNCTION public.gl_financials(p_from date, p_to date)
RETURNS TABLE (
  code text,
  name text,
  type text,
  period_debit numeric,
  period_credit numeric,
  asof_debit numeric,
  asof_credit numeric,
  opening_debit numeric,
  opening_credit numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.code,
    a.name,
    a.type::text,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date BETWEEN p_from AND p_to), 0) AS period_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date BETWEEN p_from AND p_to), 0) AS period_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date <= p_to), 0) AS asof_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date <= p_to), 0) AS asof_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE je.entry_date < p_from), 0) AS opening_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE je.entry_date < p_from), 0) AS opening_credit
  FROM public.accounts a
  LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
  LEFT JOIN public.journal_entries je ON je.id = jl.journal_id
  GROUP BY a.code, a.name, a.type
  ORDER BY a.code;
$$;

GRANT EXECUTE ON FUNCTION public.gl_financials(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gl_financials(date, date) TO service_role;

-- >>> Migration: 20260704110319_797b209c-4e89-4eb9-b695-10ca2a1689f7.sql <<<
ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS entry_date date;
CREATE INDEX IF NOT EXISTS idx_jl_null_date ON public.journal_lines (id) WHERE entry_date IS NULL;

-- >>> Migration: 20260704111325_e0dc99d8-4ec1-48f3-8b6f-4774e8684eb0.sql <<<
SET statement_timeout = 0;

CREATE INDEX IF NOT EXISTS idx_jl_acct_date ON public.journal_lines (account_id, entry_date) INCLUDE (debit, credit);

CREATE OR REPLACE FUNCTION public.jl_set_entry_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_date IS NULL THEN
    SELECT entry_date INTO NEW.entry_date FROM public.journal_entries WHERE id = NEW.journal_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_jl_entry_date ON public.journal_lines;
CREATE TRIGGER trg_jl_entry_date
  BEFORE INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.jl_set_entry_date();

CREATE OR REPLACE FUNCTION public.gl_financials(p_from date, p_to date)
 RETURNS TABLE(code text, name text, type text, period_debit numeric, period_credit numeric, asof_debit numeric, asof_credit numeric, opening_debit numeric, opening_credit numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    a.code,
    a.name,
    a.type::text,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date BETWEEN p_from AND p_to), 0) AS period_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date BETWEEN p_from AND p_to), 0) AS period_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date <= p_to), 0) AS asof_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date <= p_to), 0) AS asof_credit,
    COALESCE(SUM(jl.debit)  FILTER (WHERE jl.entry_date < p_from), 0) AS opening_debit,
    COALESCE(SUM(jl.credit) FILTER (WHERE jl.entry_date < p_from), 0) AS opening_credit
  FROM public.accounts a
  LEFT JOIN public.journal_lines jl ON jl.account_id = a.id
  GROUP BY a.code, a.name, a.type
  ORDER BY a.code;
$function$;

ALTER FUNCTION public.gl_financials(date, date) SET statement_timeout = '55s';

-- >>> Migration: 20260706151114_f356ee28-e45d-4e3a-9f06-4417819d2574.sql <<<
create table if not exists public.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  customer_id uuid references public.customers(id),
  phone text not null,
  amount numeric(12,2) not null,
  merchant_request_id text,
  checkout_request_id text,
  mpesa_receipt_number text,
  status text not null default 'pending',
  result_desc text,
  created_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_mpesa_tx_invoice on public.mpesa_transactions(invoice_id);
create index if not exists idx_mpesa_tx_checkout on public.mpesa_transactions(checkout_request_id);
create index if not exists idx_mpesa_tx_status on public.mpesa_transactions(status);

grant select, insert, update on public.mpesa_transactions to authenticated;
grant all on public.mpesa_transactions to service_role;

alter table public.mpesa_transactions enable row level security;

create policy "staff_view_mpesa_tx"
  on public.mpesa_transactions for select to authenticated
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));

create policy "staff_insert_mpesa_tx"
  on public.mpesa_transactions for insert to authenticated
  with check (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));

create policy "staff_update_mpesa_tx"
  on public.mpesa_transactions for update to authenticated
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'sales_agent'));

-- >>> Migration: 20260707155457_6c1f033e-d8c8-4fd0-bcd9-e6286982cf78.sql <<<
-- 1. New expense fields for the rebuilt module
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_no text,
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS payment_method text;

-- 2. Auto-numbering: EXP000001 ...
CREATE SEQUENCE IF NOT EXISTS public.expense_no_seq START 1;

CREATE OR REPLACE FUNCTION public.set_expense_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expense_no IS NULL OR NEW.expense_no = '' THEN
    NEW.expense_no := 'EXP' || lpad(nextval('public.expense_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_expense_no ON public.expenses;
CREATE TRIGGER trg_set_expense_no
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_expense_no();

-- Backfill existing rows
UPDATE public.expenses
SET expense_no = 'EXP' || lpad(nextval('public.expense_no_seq')::text, 6, '0')
WHERE expense_no IS NULL OR expense_no = '';

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_no_key;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_no_key UNIQUE (expense_no);

-- 3. Reverse (delete) an expense: post a contra journal, then remove the row.
-- Keeps the General Ledger correct because original journals are immutable.
CREATE OR REPLACE FUNCTION public.reverse_expense(p_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_je uuid;
  v_lines jsonb;
  v_no text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reverse expenses';
  END IF;

  SELECT journal_id, expense_no INTO v_je, v_no FROM public.expenses WHERE id = p_expense_id;

  IF v_je IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('account', a.code, 'debit', jl.credit, 'credit', jl.debit))
      INTO v_lines
      FROM public.journal_lines jl
      JOIN public.accounts a ON a.id = jl.account_id
     WHERE jl.journal_id = v_je;

    IF v_lines IS NOT NULL THEN
      PERFORM public.post_journal(
        'expense_reversal', p_expense_id,
        'Reversal of expense ' || COALESCE(v_no, ''),
        v_lines, CURRENT_DATE);
    END IF;
  END IF;

  DELETE FROM public.expenses WHERE id = p_expense_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.reverse_expense(uuid) TO authenticated;

-- 4. Ensure admins can fully manage the chart of accounts via the Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

-- >>> Migration: 20260801141234_f56f0b24-db2c-4201-8fc4-eb326566f9ff.sql <<<
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS walkin_name text,
  ADD COLUMN IF NOT EXISTS walkin_phone text;

CREATE INDEX IF NOT EXISTS idx_invoices_walkin_phone ON public.invoices (walkin_phone) WHERE walkin_phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.convert_walkin_to_customer(p_phone text, p_customer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer := 0;
  v_spent numeric := 0;
  v_balance numeric := 0;
  v_visits integer := 0;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  UPDATE public.invoices
     SET customer_id = p_customer_id,
         walkin_name = NULL,
         walkin_phone = NULL
   WHERE walkin_phone = btrim(p_phone);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT COALESCE(SUM(paid_amount),0), COALESCE(SUM(balance),0), COUNT(*)
    INTO v_spent, v_balance, v_visits
    FROM public.invoices WHERE customer_id = p_customer_id;

  UPDATE public.customers
     SET total_spent = v_spent,
         current_balance = v_balance,
         visit_count = v_visits
   WHERE id = p_customer_id;

  RETURN v_count;
END $$;

-- >>> Migration: 20260804160051_18e54d5f-5420-4c53-a999-221e53c70552.sql <<<
ALTER TABLE public.credit_notes
  ADD CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT,
  ADD CONSTRAINT credit_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.credit_note_items
  ADD CONSTRAINT credit_note_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT,
  ADD CONSTRAINT credit_note_items_invoice_item_id_fkey FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id) ON DELETE SET NULL;

-- >>> Migration: 20260805162633_318faff7-bff0-4f8b-bf81-f3a6737dffdc.sql <<<
CREATE TABLE public.opening_stock_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  item_count integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  journal_id uuid REFERENCES public.journal_entries(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.opening_stock_runs TO authenticated;
GRANT ALL ON public.opening_stock_runs TO service_role;

ALTER TABLE public.opening_stock_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view opening stock runs" ON public.opening_stock_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create opening stock runs" ON public.opening_stock_runs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.post_opening_stock(
  p_items jsonb,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_elem jsonb;
  v_pid uuid;
  v_qty integer;
  v_cost numeric;
  v_total numeric := 0;
  v_count integer := 0;
  v_is_service boolean;
  v_journal uuid;
  v_run uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can post opening stock';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_elem->>'product_id')::uuid;
    v_qty := COALESCE((v_elem->>'quantity')::integer, 0);
    v_cost := COALESCE((v_elem->>'unit_cost')::numeric, 0);

    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT is_service INTO v_is_service FROM public.products WHERE id = v_pid;
    IF v_is_service IS NULL THEN
      RAISE EXCEPTION 'Product % not found', v_pid;
    END IF;
    IF v_is_service THEN
      RAISE EXCEPTION 'Services cannot carry opening stock';
    END IF;

    INSERT INTO public.stock_batches(product_id, quantity_bought, quantity_remaining, cost_price, purchase_date)
    VALUES (v_pid, v_qty, v_qty, v_cost, p_entry_date);

    v_total := v_total + (v_qty * v_cost);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No valid opening stock lines supplied';
  END IF;

  IF v_total > 0 THEN
    v_journal := public.post_journal(
      'opening_stock', gen_random_uuid(),
      COALESCE(p_notes, 'Opening stock brought forward'),
      jsonb_build_array(
        jsonb_build_object('account','1200','debit', v_total),
        jsonb_build_object('account','3000','credit', v_total)
      ),
      p_entry_date);
  END IF;

  INSERT INTO public.opening_stock_runs(entry_date, notes, item_count, total_value, journal_id, created_by)
  VALUES (p_entry_date, p_notes, v_count, v_total, v_journal, auth.uid())
  RETURNING id INTO v_run;

  RETURN v_run;
END $$;

-- >>> Migration: 20260901162949_c4aec2a2-b3aa-4a54-b897-c2d32d5c7ac6.sql <<<

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


-- >>> Migration: 20260901163117_24a600d8-9081-4b27-93ab-d2772da0edcc.sql <<<

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


-- >>> Migration: 20260902165206_0c28ed14-881d-422f-b809-4bed22d0d522.sql <<<
CREATE POLICY "Staff can view adjustment evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'adjustment-evidence');

CREATE POLICY "Admins can upload adjustment evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can update adjustment evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can delete adjustment evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'adjustment-evidence' AND public.has_role(auth.uid(),'admin'));

-- >>> Migration: 20260903165324_1a5cea17-1639-4eb2-a941-49c3eb24f1af.sql <<<
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

-- >>> Migration: 20261001024701_c828cff7-bc48-401e-afb6-a0cd48c3ab44.sql <<<
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_vouchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
CREATE INDEX IF NOT EXISTS wifi_transactions_paid_at_idx ON public.wifi_transactions(paid_at DESC);
CREATE INDEX IF NOT EXISTS wifi_vouchers_used_at_idx ON public.wifi_vouchers(used_at DESC);

-- >>> Migration: 20261001025449_ee3bab78-e601-4413-a4b4-e75a3bf7d353.sql <<<
ALTER TABLE public.wifi_transactions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal1';
ALTER TABLE public.wifi_vouchers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal1';
CREATE INDEX IF NOT EXISTS wifi_transactions_source_paid_at_idx ON public.wifi_transactions (source, paid_at DESC);

-- >>> Migration: 20261002163831_a549b74a-2aa9-4c5d-88f6-366775bd6a32.sql <<<
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

-- >>> Migration: 20261002163841_6c1ebe3a-7c30-4165-b581-bcfbeb17ae66.sql <<<
REVOKE EXECUTE ON FUNCTION public.period_status_for(date), public.next_correction_no() FROM anon, public, authenticated;

-- >>> Migration: 20261002163850_a7643000-c40b-485b-b4d5-5c79dc880a3d.sql <<<
ALTER FUNCTION public.guard_journal_period() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.guard_journal_period() FROM anon, public, authenticated;

-- >>> Migration: 20261005021125_f83fc471-172b-4a29-84e2-44c3f952f913.sql <<<

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


-- >>> Migration: 20261005021136_a27bdf89-2075-402b-83a1-5ea27d425a42.sql <<<

REVOKE EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) TO authenticated;


-- >>> Migration: 20261006025225_c6e28a1b-ad6a-481c-9de8-2341e9a528cb.sql <<<
SELECT 1;

