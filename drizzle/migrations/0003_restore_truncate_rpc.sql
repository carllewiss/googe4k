-- TRUNCATE helper for full-table restore; only admins may call it.
CREATE OR REPLACE FUNCTION public.restore_truncate(p_tables text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can run restores';
  END IF;
  EXECUTE 'TRUNCATE TABLE ' || p_tables || ' CASCADE';
END;
$$;

REVOKE ALL ON FUNCTION public.restore_truncate(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_truncate(text) TO authenticated;
GRANT ALL ON FUNCTION public.restore_truncate(text) TO service_role;