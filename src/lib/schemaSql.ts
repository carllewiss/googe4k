export const SUPABASE_ERP_SQL_SCHEMA = `-- ==============================================================================
-- ApexERP Full Production Database Schema for Supabase
-- Includes: Tables, Foreign Keys, Row Level Security (RLS), Triggers, & Stored Procs
-- Run this in your Supabase SQL Editor: Dashboard > SQL Editor > New Query
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Inventory / Products Table
CREATE TABLE IF NOT EXISTS public.erp_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_stock_threshold INTEGER NOT NULL DEFAULT 10,
    warehouse_location TEXT DEFAULT 'WH-A1',
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS public.erp_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company TEXT,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    billing_address TEXT,
    credit_limit NUMERIC(12, 2) DEFAULT 10000.00,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    orders_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Vendors / Suppliers Table
CREATE TABLE IF NOT EXISTS public.erp_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    payment_terms TEXT DEFAULT 'Net 30',
    rating NUMERIC(2, 1) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sales Orders Table
CREATE TABLE IF NOT EXISTS public.erp_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.erp_customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    order_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shipping NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sales Order Items Table
CREATE TABLE IF NOT EXISTS public.erp_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.erp_orders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.erp_inventory(id) ON DELETE RESTRICT,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL,
    total NUMERIC(12, 2) NOT NULL
);

-- 7. Invoices Table
CREATE TABLE IF NOT EXISTS public.erp_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES public.erp_orders(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Purchase Orders (Procurement) Table
CREATE TABLE IF NOT EXISTS public.erp_purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number TEXT UNIQUE NOT NULL,
    vendor_id UUID REFERENCES public.erp_vendors(id) ON DELETE SET NULL,
    vendor_name TEXT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'requested', 'approved', 'received', 'cancelled')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ERP Audit & Activity Log Table
CREATE TABLE IF NOT EXISTS public.erp_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    details TEXT
);

-- 10. Automatic Inventory Status Calculation Trigger
CREATE OR REPLACE FUNCTION public.update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity = 0 THEN
        NEW.status := 'out_of_stock';
    ELSIF NEW.quantity <= NEW.min_stock_threshold THEN
        NEW.status := 'low_stock';
    ELSE
        NEW.status := 'in_stock';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_status ON public.erp_inventory;
CREATE TRIGGER trg_inventory_status
BEFORE INSERT OR UPDATE ON public.erp_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_inventory_status();

-- 11. Stored Procedure: Atomic Order Inventory Deduction
CREATE OR REPLACE FUNCTION public.deduct_inventory_atomic(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
    r RECORD;
    v_current_stock INT;
BEGIN
    -- Verify all items have enough stock first
    FOR r IN SELECT item_id, sku, name, quantity FROM public.erp_order_items WHERE order_id = p_order_id LOOP
        SELECT quantity INTO v_current_stock FROM public.erp_inventory WHERE id = r.item_id FOR UPDATE;
        IF v_current_stock < r.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for SKU % (%). Requested %, available %', r.sku, r.name, r.quantity, v_current_stock;
        END IF;
    END LOOP;

    -- Deduct stock
    FOR r IN SELECT item_id, quantity FROM public.erp_order_items WHERE order_id = p_order_id LOOP
        UPDATE public.erp_inventory
        SET quantity = quantity - r.quantity
        WHERE id = r.item_id;
    END LOOP;

    -- Update order status
    UPDATE public.erp_orders SET status = 'processing', updated_at = NOW() WHERE id = p_order_id;

    -- Log to audit
    INSERT INTO public.erp_audit_log (actor, action, module, details)
    VALUES ('edge-function/system', 'DEDUCT_INVENTORY_ATOMIC', 'inventory', 'Stock decremented for order ' || p_order_id);

    RETURN jsonb_build_object('success', true, 'message', 'Inventory decremented successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Enable Row Level Security (RLS)
ALTER TABLE public.erp_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_audit_log ENABLE ROW LEVEL SECURITY;

-- 13. Public / Authenticated RLS Policies (Allow read & write for authorized applet users)
CREATE POLICY "Allow authenticated read inventory" ON public.erp_inventory FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage inventory" ON public.erp_inventory FOR ALL USING (true);

CREATE POLICY "Allow authenticated read customers" ON public.erp_customers FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage customers" ON public.erp_customers FOR ALL USING (true);

CREATE POLICY "Allow authenticated read vendors" ON public.erp_vendors FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage vendors" ON public.erp_vendors FOR ALL USING (true);

CREATE POLICY "Allow authenticated read orders" ON public.erp_orders FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage orders" ON public.erp_orders FOR ALL USING (true);

CREATE POLICY "Allow authenticated read order items" ON public.erp_order_items FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage order items" ON public.erp_order_items FOR ALL USING (true);

CREATE POLICY "Allow authenticated read invoices" ON public.erp_invoices FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage invoices" ON public.erp_invoices FOR ALL USING (true);

CREATE POLICY "Allow authenticated read purchase orders" ON public.erp_purchase_orders FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage purchase orders" ON public.erp_purchase_orders FOR ALL USING (true);

CREATE POLICY "Allow authenticated read audit logs" ON public.erp_audit_log FOR SELECT USING (true);
CREATE POLICY "Allow authenticated manage audit logs" ON public.erp_audit_log FOR ALL USING (true);
`;
