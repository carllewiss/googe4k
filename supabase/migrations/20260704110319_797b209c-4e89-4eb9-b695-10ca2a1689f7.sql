ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS entry_date date;
CREATE INDEX IF NOT EXISTS idx_jl_null_date ON public.journal_lines (id) WHERE entry_date IS NULL;