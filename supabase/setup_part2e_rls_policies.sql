-- STAKD setup setup_part2e_rls_policies.sql. Run this entire file by itself.
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
