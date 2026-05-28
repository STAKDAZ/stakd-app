-- Adds PM-side multiple due dates per job.
-- Run this once in Supabase SQL Editor before using multiple due dates.

create table if not exists public.job_due_dates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  due_date date not null,
  label text,
  quantity integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_due_dates_job_id_idx on public.job_due_dates(job_id);
create index if not exists job_due_dates_due_date_idx on public.job_due_dates(due_date);

alter table public.job_due_dates enable row level security;

drop policy if exists "Admins can manage job due dates" on public.job_due_dates;
create policy "Admins can manage job due dates"
on public.job_due_dates
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'Admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, '') in ('admin', 'Admin')
  )
);

create or replace function public.touch_job_due_dates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_job_due_dates_updated_at on public.job_due_dates;
create trigger trg_touch_job_due_dates_updated_at
before update on public.job_due_dates
for each row execute function public.touch_job_due_dates_updated_at();
