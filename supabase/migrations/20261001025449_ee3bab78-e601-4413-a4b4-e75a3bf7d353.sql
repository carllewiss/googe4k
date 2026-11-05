ALTER TABLE public.wifi_transactions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal1';
ALTER TABLE public.wifi_vouchers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal1';
CREATE INDEX IF NOT EXISTS wifi_transactions_source_paid_at_idx ON public.wifi_transactions (source, paid_at DESC);