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