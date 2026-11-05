-- Add per-product VAT override. NULL = use system default rate.
ALTER TABLE public.products
  ADD COLUMN vat_rate NUMERIC(5,2);

COMMENT ON COLUMN public.products.vat_rate IS 'Optional per-product VAT %. NULL means use system_settings.default_tax_rate. Only applies when tax_category = standard.';

-- Sanity check: 0..100
ALTER TABLE public.products
  ADD CONSTRAINT products_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));