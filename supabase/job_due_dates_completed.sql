-- Adds completion tracking to each PM multiple due date / milestone.
-- Run this once in Supabase SQL Editor before replacing page.tsx.

alter table public.job_due_dates
add column if not exists is_completed boolean not null default false;

alter table public.job_due_dates
add column if not exists completed_at timestamptz null;

create index if not exists job_due_dates_job_completed_idx
on public.job_due_dates (job_id, is_completed, due_date);
