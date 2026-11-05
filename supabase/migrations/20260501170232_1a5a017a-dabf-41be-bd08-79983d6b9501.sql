-- Prevent any stock_batches row from going negative
ALTER TABLE public.stock_batches
  DROP CONSTRAINT IF EXISTS stock_batches_quantity_remaining_nonneg;
ALTER TABLE public.stock_batches
  ADD CONSTRAINT stock_batches_quantity_remaining_nonneg
  CHECK (quantity_remaining >= 0);

-- Replace FIFO deduction: refuse to oversell, skip services
CREATE OR REPLACE FUNCTION public.deduct_stock_fifo(p_product_id uuid, p_quantity integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  batch RECORD;
  remaining INTEGER := p_quantity;
  total_cogs NUMERIC := 0;
  deduct INTEGER;
  v_is_service BOOLEAN;
  v_available INTEGER;
  v_product_name TEXT;
BEGIN
  SELECT is_service, name INTO v_is_service, v_product_name
  FROM public.products WHERE id = p_product_id;

  -- Services: no stock tracking, no COGS deduction
  IF v_is_service THEN
    RETURN 0;
  END IF;

  -- Pre-flight: total available across batches
  SELECT COALESCE(SUM(quantity_remaining), 0)::INTEGER INTO v_available
  FROM public.stock_batches WHERE product_id = p_product_id;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: % has only % units available (requested %)',
      v_product_name, v_available, p_quantity
      USING ERRCODE = 'check_violation';
  END IF;

  FOR batch IN
    SELECT id, quantity_remaining, cost_price
    FROM public.stock_batches
    WHERE product_id = p_product_id AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    IF remaining <= 0 THEN EXIT; END IF;
    deduct := LEAST(remaining, batch.quantity_remaining);
    total_cogs := total_cogs + (deduct * batch.cost_price);
    UPDATE public.stock_batches
      SET quantity_remaining = quantity_remaining - deduct
      WHERE id = batch.id;
    remaining := remaining - deduct;
  END LOOP;

  RETURN total_cogs;
END;
$function$;