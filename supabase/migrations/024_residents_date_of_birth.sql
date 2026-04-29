-- Phase 5 / Slice 5b: residents CRUD form needs DOB.
-- Nullable + indexed so we can filter/sort by it later without backfilling.
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE INDEX IF NOT EXISTS idx_residents_date_of_birth ON public.residents (date_of_birth);
