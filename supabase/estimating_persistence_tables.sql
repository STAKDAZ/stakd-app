
-- DS App estimating persistence tables.
-- Run this in Supabase SQL Editor.

create table if not exists public.estimating_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.estimating_estimates (
  job_id uuid primary key,
  info jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.estimating_pieces (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  piece_id text not null,
  sort_order int not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(job_id, piece_id)
);

create table if not exists public.estimating_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text not null default '',
  pieces jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.estimating_shape_catalog (
  id uuid primary key default gen_random_uuid(),
  family text not null default '',
  shape text not null default '',
  description text not null default '',
  lbs_per_foot numeric not null default 0,
  default_grade text not null default 'A992',
  sort_order int not null default 0,
  is_archived boolean not null default false,
  material_cost_per_lb numeric,
  flange_width numeric,
  flange_thickness numeric,
  web_depth numeric,
  web_thickness numeric,
  wall_thickness numeric,
  perimeter_inches numeric,
  weight_per_sqft numeric,
  unique(family, shape)
);

create table if not exists public.estimating_weld_catalog (
  id uuid primary key default gen_random_uuid(),
  shop_setup text not null default '2024.1',
  weld_type text not null default '',
  weld_process text not null default '',
  thickness text not null default '',
  rate_per_hour numeric not null default 0,
  weight_per_ft numeric not null default 0,
  cost_per_lb numeric not null default 0,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  unique(shop_setup, weld_type, weld_process, thickness)
);

-- Keep previously-created labor engine tables safe if they already exist.
create table if not exists public.estimating_material_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.estimating_labor_codes (
  id uuid primary key default gen_random_uuid(),
  material_group_id uuid references public.estimating_material_groups(id) on delete cascade,
  code text not null,
  description text not null,
  include_cleaning boolean not null default true,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(material_group_id, code)
);

create table if not exists public.estimating_labor_operations (
  id uuid primary key default gen_random_uuid(),
  labor_code_id uuid references public.estimating_labor_codes(id) on delete cascade,
  qty numeric not null default 1,
  operation_code text,
  description text not null,
  group_name text,
  sort_order int not null default 0
);

create table if not exists public.estimating_labor_formulas (
  id uuid primary key default gen_random_uuid(),
  labor_code_id uuid references public.estimating_labor_codes(id) on delete cascade,
  qty numeric not null default 1,
  formula_type text not null,
  description text not null,
  expression jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);

insert into public.estimating_material_groups (name, sort_order)
values
  ('Angles', 10),
  ('Beams', 20),
  ('Plates', 30),
  ('HSS', 40),
  ('Rods / Rebar / Square Bar', 50),
  ('Channels / MC', 60)
on conflict (name) do nothing;

alter table public.estimating_settings enable row level security;
alter table public.estimating_estimates enable row level security;
alter table public.estimating_pieces enable row level security;
alter table public.estimating_templates enable row level security;
alter table public.estimating_shape_catalog enable row level security;
alter table public.estimating_weld_catalog enable row level security;
alter table public.estimating_material_groups enable row level security;
alter table public.estimating_labor_codes enable row level security;
alter table public.estimating_labor_operations enable row level security;
alter table public.estimating_labor_formulas enable row level security;

-- Simple authenticated policies so the estimating module works now.
-- We can tighten these to admin-only after the workflow is stable.

drop policy if exists "Authenticated manage estimating settings" on public.estimating_settings;
create policy "Authenticated manage estimating settings"
on public.estimating_settings for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating estimates" on public.estimating_estimates;
create policy "Authenticated manage estimating estimates"
on public.estimating_estimates for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating pieces" on public.estimating_pieces;
create policy "Authenticated manage estimating pieces"
on public.estimating_pieces for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating templates" on public.estimating_templates;
create policy "Authenticated manage estimating templates"
on public.estimating_templates for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating shape catalog" on public.estimating_shape_catalog;
create policy "Authenticated manage estimating shape catalog"
on public.estimating_shape_catalog for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating weld catalog" on public.estimating_weld_catalog;
create policy "Authenticated manage estimating weld catalog"
on public.estimating_weld_catalog for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating material groups" on public.estimating_material_groups;
create policy "Authenticated manage estimating material groups"
on public.estimating_material_groups for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating labor codes" on public.estimating_labor_codes;
create policy "Authenticated manage estimating labor codes"
on public.estimating_labor_codes for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating labor operations" on public.estimating_labor_operations;
create policy "Authenticated manage estimating labor operations"
on public.estimating_labor_operations for all to authenticated
using (true) with check (true);

drop policy if exists "Authenticated manage estimating labor formulas" on public.estimating_labor_formulas;
create policy "Authenticated manage estimating labor formulas"
on public.estimating_labor_formulas for all to authenticated
using (true) with check (true);
