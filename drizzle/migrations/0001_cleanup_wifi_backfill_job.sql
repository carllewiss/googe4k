CREATE OR REPLACE FUNCTION public.cleanup_wifi_backfill_step()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v integer;
  v_total integer := 0;
BEGIN
  -- Step 1: delete orphaned journal lines (their journal entry is already gone), 300k per run
  DELETE FROM public.journal_lines jl
   WHERE jl.id IN (
     SELECT jl2.id FROM public.journal_lines jl2
      WHERE NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = jl2.journal_id)
      LIMIT 300000);
  GET DIAGNOSTICS v = ROW_COUNT;
  v_total := v_total + v;
  IF v > 0 THEN RETURN v_total; END IF;

  -- Step 2: remove the 16 'Backfill' journals and their lines
  DELETE FROM public.journal_lines
   WHERE journal_id IN (SELECT id FROM public.journal_entries WHERE description ILIKE 'Backfill%');
  DELETE FROM public.journal_entries WHERE description ILIKE 'Backfill%';
  GET DIAGNOSTICS v = ROW_COUNT;
  v_total := v_total + v;
  IF v > 0 THEN RETURN v_total; END IF;

  -- Step 3: delete orphaned wifi journals (no matching wifi transaction), 200k per run
  DELETE FROM public.journal_entries je
   WHERE je.id IN (
     SELECT je2.id FROM public.journal_entries je2
      WHERE je2.reference_type = 'wifi'
        AND (je2.reference_id IS NULL
             OR NOT EXISTS (SELECT 1 FROM public.wifi_transactions wt WHERE wt.id = je2.reference_id))
      LIMIT 200000);
  GET DIAGNOSTICS v = ROW_COUNT;
  v_total := v_total + v;
  IF v > 0 THEN RETURN v_total; END IF;

  -- Step 4: null any dangling journal references left behind
  UPDATE public.wifi_transactions SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.expenses SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.credit_notes SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.fixed_assets SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.asset_maintenance SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.asset_disposals SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.asset_depreciation SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.goods_returns SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.inventory_adjustments SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.opening_stock_runs SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.payment_corrections SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);
  UPDATE public.supplier_payments SET journal_id = NULL
   WHERE journal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = journal_id);

  -- Step 5: re-create the audit-lock triggers that were dropped for the cleanup
  DROP TRIGGER IF EXISTS trg_je_no_delete ON public.journal_entries;
  CREATE TRIGGER trg_je_no_delete BEFORE DELETE ON public.journal_entries
    FOR EACH STATEMENT EXECUTE FUNCTION public.journal_audit_lock();
  DROP TRIGGER IF EXISTS trg_je_no_update ON public.journal_entries;
  CREATE TRIGGER trg_je_no_update BEFORE UPDATE ON public.journal_entries
    FOR EACH STATEMENT EXECUTE FUNCTION public.journal_audit_lock();
  DROP TRIGGER IF EXISTS trg_jl_no_delete ON public.journal_lines;
  CREATE TRIGGER trg_jl_no_delete BEFORE DELETE ON public.journal_lines
    FOR EACH STATEMENT EXECUTE FUNCTION public.journal_audit_lock();
  DROP TRIGGER IF EXISTS trg_jl_no_update ON public.journal_lines;
  CREATE TRIGGER trg_jl_no_update BEFORE DELETE ON public.journal_lines
    FOR EACH STATEMENT EXECUTE FUNCTION public.journal_audit_lock();

  -- Step 6: finish — drop the helper index, refresh stats, unschedule this job
  DROP INDEX IF EXISTS public.idx_jl_journal_del;
  ANALYZE public.journal_entries;
  ANALYZE public.journal_lines;
  PERFORM cron.unschedule('cleanup-wifi-backfill');
  RETURN v_total;
END;
$$;