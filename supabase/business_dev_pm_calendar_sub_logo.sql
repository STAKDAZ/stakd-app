-- Run this once in Supabase SQL Editor before using the subcontractor logo field.
alter table public.subcontractors
add column if not exists logo_url text;

-- Optional table for future server-side Business Development storage.
-- The first patch stores Business Development rows in the browser so it will work immediately.
create table if not exists public.business_development_opportunities (
  id uuid primary key default gen_random_uuid(),
  company text,
  contact text,
  project text,
  estimated_value numeric,
  stage text default 'Lead',
  next_follow_up date,
  assigned_to text,
  notes text,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
