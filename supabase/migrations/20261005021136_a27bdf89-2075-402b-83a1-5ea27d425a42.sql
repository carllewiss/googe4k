
REVOKE EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.correct_sale_payment(uuid, numeric, numeric, text, text) TO authenticated;
