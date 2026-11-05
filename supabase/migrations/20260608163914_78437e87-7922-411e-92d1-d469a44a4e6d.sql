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