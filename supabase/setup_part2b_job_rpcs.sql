-- STAKD setup setup_part2b_job_rpcs.sql. Run this entire file by itself.
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
