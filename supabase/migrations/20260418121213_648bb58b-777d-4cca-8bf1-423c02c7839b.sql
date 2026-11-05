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