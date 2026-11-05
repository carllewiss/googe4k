-- TEMPORARILY allow journal edits/deletes for the one-off WiFi backfill cleanup.
-- These 4 audit-lock triggers are re-created by a companion migration after cleanup.
DROP TRIGGER IF EXISTS trg_jl_no_update ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_jl_no_delete ON public.journal_lines;
DROP TRIGGER IF EXISTS trg_je_no_update ON public.journal_entries;
DROP TRIGGER IF EXISTS trg_je_no_delete ON public.journal_entries;
CREATE INDEX IF NOT EXISTS idx_jl_journal_del ON public.journal_lines USING btree (journal_id);