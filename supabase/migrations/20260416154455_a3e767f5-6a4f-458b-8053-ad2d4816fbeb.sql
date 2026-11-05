
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
