alter table public.estimating_shape_catalog
add column if not exists material_cost_per_lb numeric,
add column if not exists flange_width numeric,
add column if not exists flange_thickness numeric,
add column if not exists web_depth numeric,
add column if not exists web_thickness numeric,
add column if not exists wall_thickness numeric,
add column if not exists perimeter_inches numeric,
add column if not exists weight_per_sqft numeric;

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

alter table public.estimating_material_groups enable row level security;
alter table public.estimating_labor_codes enable row level security;
alter table public.estimating_labor_operations enable row level security;
alter table public.estimating_labor_formulas enable row level security;

drop policy if exists "Admins manage estimating material groups" on public.estimating_material_groups;
create policy "Admins manage estimating material groups"
on public.estimating_material_groups for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'));

drop policy if exists "Admins manage estimating labor codes" on public.estimating_labor_codes;
create policy "Admins manage estimating labor codes"
on public.estimating_labor_codes for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'));

drop policy if exists "Admins manage estimating labor operations" on public.estimating_labor_operations;
create policy "Admins manage estimating labor operations"
on public.estimating_labor_operations for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'));

drop policy if exists "Admins manage estimating labor formulas" on public.estimating_labor_formulas;
create policy "Admins manage estimating labor formulas"
on public.estimating_labor_formulas for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'));

insert into public.estimating_material_groups (name, sort_order)
values
  ('Angles', 10),
  ('Beams', 20),
  ('Plates', 30),
  ('HSS', 40),
  ('Rods / Rebar / Square Bar', 50),
  ('Channels / MC', 60)
on conflict (name) do nothing;
