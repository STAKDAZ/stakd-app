-- STAKD setup setup_part2a_core.sql. Run this entire file by itself.
-- STAKD production foundation part 2. Run after the bootstrap SQL succeeds.
create extension if not exists pgcrypto;
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
