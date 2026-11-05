DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wifi_vouchers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
CREATE INDEX IF NOT EXISTS wifi_transactions_paid_at_idx ON public.wifi_transactions(paid_at DESC);
CREATE INDEX IF NOT EXISTS wifi_vouchers_used_at_idx ON public.wifi_vouchers(used_at DESC);