-- Run this in Supabase SQL Editor if the dashboard does not show all years after replacing the files.
-- It makes p_year optional. When the app sends p_year = null, every job year is returned.

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
  where
    (p_year is null or j.job_number like right(p_year::text, 2) || '-%')
    and (p_client_id is null or j.client_id = p_client_id)
    and (p_include_archived or coalesce(j.is_archived, false) = false)
  order by j.job_number asc;
$$;
