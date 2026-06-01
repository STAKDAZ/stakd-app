-- STAKD production foundation.
-- Run this in Supabase SQL Editor after the base STAKD/Dura Steel tables exist.
-- It fills the RPC and schema gaps that the current Next app calls directly.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color_hex text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  tons_per_week numeric,
  default_lead_time_days integer,
  logo_url text,
  is_archived boolean not null default false,
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique,
  job_name text not null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'Quoting',
  pm_status text,
  rfq_url text,
  quoted_amount numeric,
  percent_complete numeric not null default 0,
  projected_finish_date date,
  fabrication_due_date date,
  project_notes text,
  ship_to_name text,
  ship_to_address text,
  qb_entered boolean not null default false,
  billed boolean not null default false,
  po_number text,
  po_url text,
  job_folder_url text,
  shipping_tickets_url text,
  outsourced_to uuid references public.subcontractors(id) on delete set null,
  outsourced_amount numeric,
  is_archived boolean not null default false,
  created_notified_at timestamptz,
  won_notified_at timestamptz,
  bill_ready_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_client_id_idx on public.jobs(client_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_is_archived_idx on public.jobs(is_archived);
create index if not exists jobs_outsourced_to_idx on public.jobs(outsourced_to);

create or replace function public.is_stakd_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') ilike '%@stakdaz.com';
$$;

alter table public.clients add column if not exists color_hex text;
alter table public.clients add column if not exists is_archived boolean not null default false;

alter table public.subcontractors add column if not exists address text;
alter table public.subcontractors add column if not exists notes text;
alter table public.subcontractors add column if not exists tons_per_week numeric;
alter table public.subcontractors add column if not exists default_lead_time_days integer;
alter table public.subcontractors add column if not exists logo_url text;
alter table public.subcontractors add column if not exists is_archived boolean not null default false;
alter table public.subcontractors add column if not exists sort_order integer not null default 1000;

alter table public.jobs add column if not exists pm_status text;
alter table public.jobs add column if not exists fabrication_due_date date;
alter table public.jobs add column if not exists project_notes text;
alter table public.jobs add column if not exists ship_to_name text;
alter table public.jobs add column if not exists ship_to_address text;
alter table public.jobs add column if not exists shipping_tickets_url text;
alter table public.jobs add column if not exists outsourced_to uuid references public.subcontractors(id);
alter table public.jobs add column if not exists outsourced_amount numeric;
alter table public.jobs add column if not exists is_archived boolean not null default false;
alter table public.jobs add column if not exists created_notified_at timestamptz;
alter table public.jobs add column if not exists won_notified_at timestamptz;
alter table public.jobs add column if not exists bill_ready_notified_at timestamptz;

alter table public.clients enable row level security;
alter table public.subcontractors enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "Admins manage clients" on public.clients;
create policy "Admins manage clients"
on public.clients for all to authenticated
using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage subcontractors" on public.subcontractors;
create policy "Admins manage subcontractors"
on public.subcontractors for all to authenticated
using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage jobs" on public.jobs;
create policy "Admins manage jobs"
on public.jobs for all to authenticated
using (public.is_stakd_admin()) with check (public.is_stakd_admin());

create table if not exists public.notification_settings (
  event_key text primary key,
  recipients text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_settings_event_key_check
    check (event_key in ('job_created', 'job_won', 'job_completed'))
);

insert into public.notification_settings (event_key, recipients)
values
  ('job_created', array['joe@stakdaz.com', 'pm@stakdaz.com']),
  ('job_won', array['accounting@stakdaz.com', 'joe@stakdaz.com', 'pm@stakdaz.com']),
  ('job_completed', array['accounting@stakdaz.com', 'joe@stakdaz.com', 'pm@stakdaz.com'])
on conflict (event_key) do nothing;

alter table public.notification_settings enable row level security;

drop policy if exists "Admins manage notification settings" on public.notification_settings;
create policy "Admins manage notification settings"
on public.notification_settings
for all
to authenticated
using (public.is_stakd_admin())
with check (
  public.is_stakd_admin()
  and not exists (
    select 1
    from unnest(recipients) as recipient
    where recipient !~* '^[^@\s]+@stakdaz\.com$'
  )
);

create or replace function public.admin_clients_list()
returns table (
  id uuid,
  name text,
  color_hex text,
  is_archived boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.color_hex, coalesce(c.is_archived, false)
  from public.clients c
  where public.is_stakd_admin()
  order by coalesce(c.is_archived, false), c.name;
$$;

create or replace function public.admin_client_add(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.clients (name, is_archived)
  values (nullif(trim(p_name), ''), false);
end;
$$;

create or replace function public.admin_client_update(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  update public.clients
  set name = nullif(trim(p_name), '')
  where id = p_id;
end;
$$;

create or replace function public.admin_client_set_color(p_id uuid, p_color_hex text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  update public.clients
  set color_hex = nullif(trim(p_color_hex), '')
  where id = p_id;
end;
$$;

create or replace function public.admin_client_set_archived(p_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  update public.clients
  set is_archived = coalesce(p_archived, false)
  where id = p_id;
end;
$$;

create or replace function public.admin_subcontractors_list(p_include_archived boolean default false)
returns table (
  id uuid,
  name text,
  description text,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  is_archived boolean
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.description,
    s.contact_name,
    s.email,
    s.phone,
    s.address,
    s.notes,
    coalesce(s.is_archived, false)
  from public.subcontractors s
  where public.is_stakd_admin()
    and (p_include_archived or coalesce(s.is_archived, false) = false)
  order by coalesce(s.sort_order, 1000), s.name;
$$;

drop function if exists public.admin_jobs_list(integer, uuid, boolean);

create or replace function public.admin_jobs_list(
  p_year int default null,
  p_client_id uuid default null,
  p_include_archived boolean default false
)
returns table (
  id uuid,
  job_number text,
  job_name text,
  client_id uuid,
  client_name text,
  status text,
  rfq_url text,
  quoted_amount numeric,
  percent_complete numeric,
  projected_finish_date date,
  qb_entered boolean,
  billed boolean,
  po_number text,
  po_url text,
  job_folder_url text,
  shipping_tickets_url text,
  outsourced_to uuid,
  outsourced_name text,
  outsourced_amount numeric,
  is_archived boolean,
  won_notified_at timestamptz,
  bill_ready_notified_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    j.id,
    j.job_number,
    j.job_name,
    j.client_id,
    c.name as client_name,
    j.status,
    j.rfq_url,
    j.quoted_amount,
    j.percent_complete,
    j.projected_finish_date,
    coalesce(j.qb_entered, false) as qb_entered,
    coalesce(j.billed, false) as billed,
    j.po_number,
    j.po_url,
    j.job_folder_url,
    j.shipping_tickets_url,
    j.outsourced_to,
    s.name as outsourced_name,
    j.outsourced_amount,
    coalesce(j.is_archived, false) as is_archived,
    j.won_notified_at,
    j.bill_ready_notified_at
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  left join public.subcontractors s on s.id = j.outsourced_to
  where public.is_stakd_admin()
    and (p_year is null or j.job_number like right(p_year::text, 2) || '-%')
    and (p_client_id is null or j.client_id = p_client_id)
    and (p_include_archived or coalesce(j.is_archived, false) = false)
  order by j.job_number asc;
$$;

create or replace function public.admin_job_patch(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  update public.jobs
  set
    job_name = case when p_patch ? 'job_name' then p_patch ->> 'job_name' else job_name end,
    client_id = case when p_patch ? 'client_id' then nullif(p_patch ->> 'client_id', '')::uuid else client_id end,
    status = case when p_patch ? 'status' then p_patch ->> 'status' else status end,
    rfq_url = case when p_patch ? 'rfq_url' then p_patch ->> 'rfq_url' else rfq_url end,
    quoted_amount = case when p_patch ? 'quoted_amount' then nullif(p_patch ->> 'quoted_amount', '')::numeric else quoted_amount end,
    percent_complete = case when p_patch ? 'percent_complete' then coalesce(nullif(p_patch ->> 'percent_complete', '')::numeric, 0) else percent_complete end,
    projected_finish_date = case when p_patch ? 'projected_finish_date' then nullif(p_patch ->> 'projected_finish_date', '')::date else projected_finish_date end,
    fabrication_due_date = case when p_patch ? 'fabrication_due_date' then nullif(p_patch ->> 'fabrication_due_date', '')::date else fabrication_due_date end,
    qb_entered = case when p_patch ? 'qb_entered' then coalesce((p_patch ->> 'qb_entered')::boolean, false) else qb_entered end,
    billed = case when p_patch ? 'billed' then coalesce((p_patch ->> 'billed')::boolean, false) else billed end,
    po_number = case when p_patch ? 'po_number' then p_patch ->> 'po_number' else po_number end,
    po_url = case when p_patch ? 'po_url' then p_patch ->> 'po_url' else po_url end,
    job_folder_url = case when p_patch ? 'job_folder_url' then p_patch ->> 'job_folder_url' else job_folder_url end,
    shipping_tickets_url = case when p_patch ? 'shipping_tickets_url' then p_patch ->> 'shipping_tickets_url' else shipping_tickets_url end,
    outsourced_to = case when p_patch ? 'outsourced_to' then nullif(p_patch ->> 'outsourced_to', '')::uuid else outsourced_to end,
    outsourced_amount = case when p_patch ? 'outsourced_amount' then nullif(p_patch ->> 'outsourced_amount', '')::numeric else outsourced_amount end,
    is_archived = case when p_patch ? 'is_archived' then coalesce((p_patch ->> 'is_archived')::boolean, false) else is_archived end
  where id = p_id;
end;
$$;

create or replace function public.admin_job_patch_by_job_number(p_job_number text, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  select id into target_id
  from public.jobs
  where job_number = p_job_number
  limit 1;

  if target_id is null then
    raise exception 'Job not found: %', p_job_number;
  end if;

  perform public.admin_job_patch(target_id, p_patch);
end;
$$;

create or replace function public.admin_add_job(
  p_job_number text,
  p_job_name text,
  p_client_id uuid default null,
  p_status text default 'Quoting',
  p_rfq_url text default null,
  p_quoted_amount numeric default null,
  p_percent_complete numeric default 0,
  p_projected_finish_date date default null,
  p_po_number text default null,
  p_po_url text default null,
  p_job_folder_url text default null,
  p_outsourced_to uuid default null,
  p_outsourced_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.jobs (
    job_number,
    job_name,
    client_id,
    status,
    rfq_url,
    quoted_amount,
    percent_complete,
    projected_finish_date,
    fabrication_due_date,
    po_number,
    po_url,
    job_folder_url,
    outsourced_to,
    outsourced_amount,
    is_archived
  )
  values (
    p_job_number,
    p_job_name,
    p_client_id,
    p_status,
    p_rfq_url,
    p_quoted_amount,
    coalesce(p_percent_complete, 0),
    p_projected_finish_date,
    p_projected_finish_date,
    p_po_number,
    p_po_url,
    p_job_folder_url,
    p_outsourced_to,
    p_outsourced_amount,
    false
  );
end;
$$;

create table if not exists public.job_pm_details (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sold_to_name text,
  sold_to_address text,
  ship_to_name text,
  ship_to_address text,
  customer_po text,
  internal_po text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id)
);

create table if not exists public.job_due_dates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  due_date date not null,
  label text,
  quantity integer,
  sort_order integer not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_due_dates_job_id_idx on public.job_due_dates(job_id);
create index if not exists job_due_dates_due_date_idx on public.job_due_dates(due_date);

create table if not exists public.subcontractor_assignments (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  scope_name text,
  scope_description text,
  start_date date,
  due_date date,
  promised_finish_date date,
  status text not null default 'Active',
  assigned_tons numeric,
  completed_tons numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subcontractor_id, job_id, scope_name)
);

create table if not exists public.shipping_loads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  load_number integer,
  ship_date date,
  ship_to_name text,
  ship_to_address text,
  po_number text,
  assembly_quantity integer,
  weight_loaded_lbs numeric,
  ticket_notes text,
  shipping_signature_name text,
  received_signature_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_load_items (
  id uuid primary key default gen_random_uuid(),
  shipping_load_id uuid not null references public.shipping_loads(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  line_no integer,
  mark text,
  sequence text,
  quantity integer,
  weight_lbs numeric,
  description text,
  finish text,
  created_at timestamptz not null default now()
);

create table if not exists public.qc_checklists (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  shipping_load_id uuid references public.shipping_loads(id) on delete set null,
  checklist_type text not null,
  checklist_date date not null default current_date,
  status text not null default 'Open',
  inspector_name text,
  approved_by text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.qc_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.qc_checklists(id) on delete cascade,
  line_no integer not null default 0,
  item_label text not null,
  is_checked boolean not null default false,
  note text
);

create or replace function public.seed_qc_checklist_items(p_checklist_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_stakd_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.qc_checklist_items (checklist_id, line_no, item_label)
  values
    (p_checklist_id, 10, 'Verify marks and quantities'),
    (p_checklist_id, 20, 'Check dimensions and finish'),
    (p_checklist_id, 30, 'Confirm embeds, plates, and hardware'),
    (p_checklist_id, 40, 'Confirm load photos and paperwork')
  on conflict do nothing;
end;
$$;

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

alter table public.job_pm_details enable row level security;
alter table public.job_due_dates enable row level security;
alter table public.subcontractor_assignments enable row level security;
alter table public.shipping_loads enable row level security;
alter table public.shipping_load_items enable row level security;
alter table public.qc_checklists enable row level security;
alter table public.qc_checklist_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_items enable row level security;
alter table public.estimating_settings enable row level security;
alter table public.estimating_estimates enable row level security;
alter table public.estimating_templates enable row level security;
alter table public.estimating_shape_catalog enable row level security;
alter table public.estimating_weld_catalog enable row level security;
alter table public.estimating_material_shapes enable row level security;
alter table public.estimating_material_sizes enable row level security;
alter table public.estimating_rates enable row level security;
alter table public.estimating_material_groups enable row level security;
alter table public.estimating_labor_codes enable row level security;
alter table public.estimating_labor_operations enable row level security;
alter table public.estimating_labor_formulas enable row level security;
alter table public.estimating_items enable row level security;
alter table public.business_development_opportunities enable row level security;

drop policy if exists "Admins manage job pm details" on public.job_pm_details;
create policy "Admins manage job pm details" on public.job_pm_details for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage job due dates" on public.job_due_dates;
create policy "Admins manage job due dates" on public.job_due_dates for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage subcontractor assignments" on public.subcontractor_assignments;
create policy "Admins manage subcontractor assignments" on public.subcontractor_assignments for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage shipping loads" on public.shipping_loads;
create policy "Admins manage shipping loads" on public.shipping_loads for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage shipping load items" on public.shipping_load_items;
create policy "Admins manage shipping load items" on public.shipping_load_items for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage qc checklists" on public.qc_checklists;
create policy "Admins manage qc checklists" on public.qc_checklists for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage qc checklist items" on public.qc_checklist_items;
create policy "Admins manage qc checklist items" on public.qc_checklist_items for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage import batches" on public.import_batches;
create policy "Admins manage import batches" on public.import_batches for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage import items" on public.import_items;
create policy "Admins manage import items" on public.import_items for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating settings" on public.estimating_settings;
create policy "Admins manage estimating settings" on public.estimating_settings for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating estimates" on public.estimating_estimates;
create policy "Admins manage estimating estimates" on public.estimating_estimates for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating templates" on public.estimating_templates;
create policy "Admins manage estimating templates" on public.estimating_templates for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating shape catalog" on public.estimating_shape_catalog;
create policy "Admins manage estimating shape catalog" on public.estimating_shape_catalog for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating weld catalog" on public.estimating_weld_catalog;
create policy "Admins manage estimating weld catalog" on public.estimating_weld_catalog for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating material shapes" on public.estimating_material_shapes;
create policy "Admins manage estimating material shapes" on public.estimating_material_shapes for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating material sizes" on public.estimating_material_sizes;
create policy "Admins manage estimating material sizes" on public.estimating_material_sizes for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating rates" on public.estimating_rates;
create policy "Admins manage estimating rates" on public.estimating_rates for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating material groups" on public.estimating_material_groups;
create policy "Admins manage estimating material groups" on public.estimating_material_groups for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating labor codes" on public.estimating_labor_codes;
create policy "Admins manage estimating labor codes" on public.estimating_labor_codes for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating labor operations" on public.estimating_labor_operations;
create policy "Admins manage estimating labor operations" on public.estimating_labor_operations for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating labor formulas" on public.estimating_labor_formulas;
create policy "Admins manage estimating labor formulas" on public.estimating_labor_formulas for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage estimating items" on public.estimating_items;
create policy "Admins manage estimating items" on public.estimating_items for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());

drop policy if exists "Admins manage business development opportunities" on public.business_development_opportunities;
create policy "Admins manage business development opportunities" on public.business_development_opportunities for all to authenticated using (public.is_stakd_admin()) with check (public.is_stakd_admin());
