-- Accounting notification support columns.
-- Safe to run more than once in Supabase SQL Editor.
alter table public.jobs
  add column if not exists won_notified_at timestamptz,
  add column if not exists bill_ready_notified_at timestamptz;
