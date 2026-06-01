-- STAKD setup setup_part2c_ops_tables.sql. Run this entire file by itself.
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
