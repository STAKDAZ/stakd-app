-- STAKD setup setup_part2d_estimating_tables.sql. Run this entire file by itself.
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  file_type text,
  original_filename text,
  imported_at timestamptz not null default now(),
  source_application text,
  source_application_version text,
  plugin_version text,
  source_project_number text,
  source_project_name text,
  source_file_creation_date text,
  status text,
  error_text text
);
create table if not exists public.import_items (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  drawing_number text,
  drawing_title text,
  drawing_category text,
  drawing_revision text,
  assembly_mark text,
  sequence text,
  phase text,
  quantity integer,
  weight_lbs numeric,
  dimensions text,
  grade text,
  finish text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.estimating_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.estimating_estimates (
  id uuid default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  estimate_name text,
  estimator_name text,
  status text,
  notes text,
  info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimating_estimates add column if not exists id uuid default gen_random_uuid();
alter table public.estimating_estimates add column if not exists estimate_name text;
alter table public.estimating_estimates add column if not exists estimator_name text;
alter table public.estimating_estimates add column if not exists status text;
alter table public.estimating_estimates add column if not exists notes text;
alter table public.estimating_estimates add column if not exists created_at timestamptz not null default now();
alter table public.estimating_estimates add column if not exists updated_at timestamptz not null default now();

create unique index if not exists estimating_estimates_id_uidx
on public.estimating_estimates(id);

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
  sort_order integer not null default 0,
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
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  unique(shop_setup, weld_type, weld_process, thickness)
);

create table if not exists public.estimating_material_shapes (
  id uuid primary key default gen_random_uuid(),
  shape_code text not null unique,
  shape_name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.estimating_material_sizes (
  id uuid primary key default gen_random_uuid(),
  shape_id uuid references public.estimating_material_shapes(id) on delete set null,
  size_label text not null unique,
  weight_per_ft numeric not null default 0,
  grade text,
  width numeric,
  thickness numeric,
  depth numeric,
  flange_width numeric,
  flange_thickness numeric,
  web_thickness numeric,
  perimeter numeric,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.estimating_rates (
  id uuid primary key default gen_random_uuid(),
  rate_code text,
  rate_type text,
  material_shape_code text,
  rate_value numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estimating_material_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.estimating_labor_codes (
  id uuid primary key default gen_random_uuid(),
  material_group_id uuid references public.estimating_material_groups(id) on delete cascade,
  material_shape_code text,
  code text not null,
  description text not null,
  include_cleaning boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
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
  sort_order integer not null default 0
);

create table if not exists public.estimating_labor_formulas (
  id uuid primary key default gen_random_uuid(),
  labor_code_id uuid references public.estimating_labor_codes(id) on delete cascade,
  qty numeric not null default 1,
  formula_type text not null,
  formula_key text,
  formula_label text,
  output_group text,
  description text not null,
  expression jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

alter table public.estimating_labor_codes
  add column if not exists material_shape_code text;

alter table public.estimating_labor_formulas add column if not exists formula_key text;
alter table public.estimating_labor_formulas add column if not exists formula_label text;
alter table public.estimating_labor_formulas add column if not exists output_group text;
alter table public.estimating_labor_formulas add column if not exists is_active boolean not null default true;

create table if not exists public.estimating_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null,
  line_no integer,
  mark text,
  quantity numeric,
  shape_code text,
  size_label text,
  length numeric,
  labor_code text,
  piece_weight numeric,
  total_weight numeric,
  processing_hours numeric,
  shop_hours numeric,
  total_hours numeric,
  calculated_breakdown jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create or replace view public.estimating_labor_code_formulas as
select
  id,
  labor_code_id,
  qty,
  formula_type,
  description,
  expression,
  sort_order,
  coalesce(is_active, true) as is_active
from public.estimating_labor_formulas;

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
