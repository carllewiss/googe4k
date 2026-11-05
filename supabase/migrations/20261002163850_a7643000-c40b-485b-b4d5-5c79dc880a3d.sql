ALTER FUNCTION public.guard_journal_period() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.guard_journal_period() FROM anon, public, authenticated;