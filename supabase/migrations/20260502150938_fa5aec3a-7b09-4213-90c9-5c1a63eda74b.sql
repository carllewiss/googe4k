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