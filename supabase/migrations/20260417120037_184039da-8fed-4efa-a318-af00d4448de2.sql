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