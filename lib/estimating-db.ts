import { supabase } from '@/lib/supabase/client';
import { ensureEstimate, type EstimatePiece, type EstimateSettings, type JobEstimate } from '@/lib/estimating';
import { shapeCatalog as starterShapeCatalog } from '@/lib/shape-catalog';
import { weldCatalog as starterWeldCatalog } from '@/lib/weld-catalog';

const SETTINGS_ID = 'global';

export type AssemblyTemplate = {
  id: string;
  name: string;
  notes: string;
  pieces: EstimatePiece[];
  updated_at?: string;
};

export type DbShapeCatalogItem = {
  id: string;
  family: string;
  shape: string;
  description: string;
  lbsPerFoot: number;
  defaultGrade: string;
  sortOrder: number;
  isArchived: boolean;
};

export type DbWeldCatalogItem = {
  id: string;
  shopSetup: string;
  weldType: string;
  weldProcess: string;
  thickness: string;
  ratePerHour: number;
  weightPerFt: number;
  costPerLb: number;
  sortOrder: number;
  isArchived: boolean;
};

function mapShapeRow(row: any): DbShapeCatalogItem {
  return {
    id: row.id,
    family: row.family ?? '',
    shape: row.shape ?? '',
    description: row.description ?? '',
    lbsPerFoot: Number(row.lbs_per_foot ?? 0),
    defaultGrade: row.default_grade ?? 'A992',
    sortOrder: Number(row.sort_order ?? 0),
    isArchived: Boolean(row.is_archived),
  };
}

function mapWeldRow(row: any): DbWeldCatalogItem {
  return {
    id: row.id,
    shopSetup: row.shop_setup ?? '2024.1',
    weldType: row.weld_type ?? '',
    weldProcess: row.weld_process ?? '',
    thickness: row.thickness ?? '',
    ratePerHour: Number(row.rate_per_hour ?? 0),
    weightPerFt: Number(row.weight_per_ft ?? 0),
    costPerLb: Number(row.cost_per_lb ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    isArchived: Boolean(row.is_archived),
  };
}

export async function loadDbSettings(): Promise<EstimateSettings | null> {
  const { data, error } = await supabase.from('estimating_settings').select('data').eq('id', SETTINGS_ID).maybeSingle();
  if (error) throw error;
  return (data?.data as EstimateSettings | undefined) ?? null;
}

export async function saveDbSettings(settings: EstimateSettings) {
  const { error } = await supabase.from('estimating_settings').upsert({ id: SETTINGS_ID, data: settings }, { onConflict: 'id' });
  if (error) throw error;
}

export async function loadDbEstimate(jobId: string, jobNumber: string, jobName: string, clientName = ''): Promise<JobEstimate> {
  const { data: headers, error: headerError } = await supabase
    .from('estimating_estimates')
    .select('id, job_id, estimate_name, estimator_name, notes, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (headerError) throw headerError;

  const headerList = (headers ?? []) as any[];
  if (!headerList.length) return ensureEstimate({}, jobId, jobNumber, jobName, clientName);

  // Important: earlier versions could accidentally create a newer empty header.
  // Scan recent headers and load the newest one that actually has piece rows.
  let selectedHeader: any | undefined;
  let selectedRows: any[] = [];

  for (const possibleHeader of headerList) {
    const { data: rows, error: rowsError } = await supabase
      .from('estimating_items')
      .select('id, line_no, mark, quantity, shape_code, size_label, length, labor_code, piece_weight, calculated_breakdown, notes')
      .eq('estimate_id', possibleHeader.id)
      .order('line_no', { ascending: true });
    if (rowsError) throw rowsError;

    selectedHeader = selectedHeader ?? possibleHeader;
    selectedRows = selectedRows.length ? selectedRows : ((rows ?? []) as any[]);

    if ((rows ?? []).length) {
      selectedHeader = possibleHeader;
      selectedRows = (rows ?? []) as any[];
      break;
    }
  }

  const header = selectedHeader;
  let info: JobEstimate['info'] | undefined;
  let headerBackup: Partial<JobEstimate> | undefined;
  try {
    const parsedNotes = header?.notes ? JSON.parse(header.notes) : undefined;
    info = parsedNotes?.info;
    headerBackup = parsedNotes?.fullEstimate;
  } catch {
    info = undefined;
    headerBackup = undefined;
  }

  if (!selectedRows.length && Array.isArray(headerBackup?.pieces) && headerBackup!.pieces!.length) {
    return ensureEstimate(headerBackup, jobId, jobNumber, jobName, clientName);
  }

  const pieces = selectedRows.map((row, index) => {
    const savedPiece = row.calculated_breakdown?.piece;
    if (savedPiece) return { id: savedPiece.id ?? row.id, ...savedPiece };
    return {
      id: row.id,
      item: row.line_no || (index + 1) * 10,
      partNumber: row.mark ?? '',
      quantity: Number(row.quantity ?? 1),
      shape: row.size_label ?? row.shape_code ?? '',
      description: row.shape_code ?? '',
      lengthFeet: Number(row.length ?? 0),
      extraCode: row.labor_code ?? 'A',
      manualWeightLbs: row.piece_weight ? Number(row.piece_weight) : null,
      notes: row.notes ?? '',
    } as Partial<EstimatePiece>;
  }) as EstimatePiece[];

  return ensureEstimate({ jobId, jobNumber, jobName, clientName, info, pieces }, jobId, jobNumber, jobName, clientName);
}

export async function saveDbEstimate(estimate: JobEstimate) {
  const { data: existingHeaders, error: findError } = await supabase
    .from('estimating_estimates')
    .select('id, created_at')
    .eq('job_id', estimate.jobId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (findError) throw findError;

  let headerId = ((existingHeaders ?? []) as any[])[0]?.id as string | undefined;

  if (!headerId) {
    const { data: header, error: headerError } = await supabase
      .from('estimating_estimates')
      .insert({
        job_id: estimate.jobId,
        estimate_name: `${estimate.jobNumber || 'Job'} Estimate`,
        estimator_name: estimate.info?.estimator || null,
        status: 'draft',
        notes: JSON.stringify({ info: estimate.info, fullEstimate: estimate }),
      })
      .select('id')
      .single();
    if (headerError) throw headerError;
    headerId = header.id;
  } else {
    const { error: updateError } = await supabase
      .from('estimating_estimates')
      .update({
        estimate_name: `${estimate.jobNumber || 'Job'} Estimate`,
        estimator_name: estimate.info?.estimator || null,
        notes: JSON.stringify({ info: estimate.info, fullEstimate: estimate }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', headerId);
    if (updateError) throw updateError;
  }

  // Guardrail: do not wipe an existing estimate just because the UI loaded an empty estimate.
  // If the estimator truly needs to clear every line, we can add a dedicated "Clear Estimate" button later.
  if (!estimate.pieces.length) return;

  const { error: deleteItemsError } = await supabase.from('estimating_items').delete().eq('estimate_id', headerId);
  if (deleteItemsError) throw deleteItemsError;

  const payload = estimate.pieces.map((piece, index) => {
    const length = Number(piece.lengthFeet ?? 0) + Number(piece.lengthInches ?? 0) / 12;
    return {
      estimate_id: headerId,
      line_no: Number(piece.item || (index + 1) * 10),
      mark: piece.partNumber || null,
      quantity: Number(piece.quantity || 1),
      shape_code: piece.shape?.replace(/[0-9].*$/, '') || 'MISC',
      size_label: piece.shape || null,
      length,
      labor_code: piece.extraCode || null,
      piece_weight: piece.manualWeightLbs ?? 0,
      total_weight: 0,
      processing_hours: Number(piece.addCutHours ?? 0) + Number(piece.addMoveHours ?? 0) + Number(piece.addLayoutHours ?? 0),
      shop_hours: Number(piece.addWeldHours ?? 0),
      total_hours: Number(piece.addCutHours ?? 0) + Number(piece.addMoveHours ?? 0) + Number(piece.addLayoutHours ?? 0) + Number(piece.addWeldHours ?? 0),
      calculated_breakdown: { piece },
      notes: piece.notes || null,
    };
  });
  const { error: insertError } = await supabase.from('estimating_items').insert(payload);
  if (insertError) throw insertError;
}

export async function listAssemblyTemplates(): Promise<AssemblyTemplate[]> {
  const { data, error } = await supabase
    .from('estimating_templates')
    .select('id, name, notes, updated_at, pieces')
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes ?? '',
    updated_at: row.updated_at,
    pieces: Array.isArray(row.pieces) ? row.pieces : [],
  }));
}

export async function saveAssemblyTemplate(template: Pick<AssemblyTemplate, 'id' | 'name' | 'notes' | 'pieces'>) {
  const payload = {
    id: template.id || undefined,
    name: template.name,
    notes: template.notes,
    pieces: template.pieces,
  };
  const { error } = await supabase.from('estimating_templates').upsert(payload).select('id').single();
  if (error) throw error;
}

export async function deleteAssemblyTemplate(id: string) {
  const { error } = await supabase.from('estimating_templates').delete().eq('id', id);
  if (error) throw error;
}

export async function listShapeCatalogItems(): Promise<DbShapeCatalogItem[]> {
  const { data, error } = await supabase
    .from('estimating_shape_catalog')
    .select('id, family, shape, description, lbs_per_foot, default_grade, sort_order, is_archived')
    .order('sort_order', { ascending: true })
    .order('family', { ascending: true })
    .order('shape', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapShapeRow);
}

export async function upsertShapeCatalogItem(item: Partial<DbShapeCatalogItem>) {
  const payload = {
    id: item.id,
    family: item.family,
    shape: item.shape,
    description: item.description ?? item.shape ?? '',
    lbs_per_foot: item.lbsPerFoot ?? 0,
    default_grade: item.defaultGrade ?? 'A992',
    sort_order: item.sortOrder ?? 0,
    is_archived: item.isArchived ?? false,
  };
  const { data, error } = await supabase
    .from('estimating_shape_catalog')
    .upsert(payload, { onConflict: 'id' })
    .select('id, family, shape, description, lbs_per_foot, default_grade, sort_order, is_archived')
    .single();
  if (error) throw error;
  return mapShapeRow(data);
}

export async function deleteShapeCatalogItem(id: string) {
  const { error } = await supabase.from('estimating_shape_catalog').delete().eq('id', id);
  if (error) throw error;
}

export async function seedShapeCatalogItems(): Promise<DbShapeCatalogItem[]> {
  const payload = starterShapeCatalog.map((row, index) => ({
    family: row.family,
    shape: row.shape,
    description: row.description,
    lbs_per_foot: row.lbsPerFoot,
    default_grade: row.defaultGrade ?? 'A992',
    sort_order: index,
    is_archived: false,
  }));
  const { error } = await supabase.from('estimating_shape_catalog').insert(payload);
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  return listShapeCatalogItems();
}

export async function listWeldCatalogItems(): Promise<DbWeldCatalogItem[]> {
  const { data, error } = await supabase
    .from('estimating_weld_catalog')
    .select('id, shop_setup, weld_type, weld_process, thickness, rate_per_hour, weight_per_ft, cost_per_lb, sort_order, is_archived')
    .order('sort_order', { ascending: true })
    .order('shop_setup', { ascending: true })
    .order('weld_type', { ascending: true })
    .order('weld_process', { ascending: true })
    .order('thickness', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapWeldRow);
}

export async function upsertWeldCatalogItem(item: Partial<DbWeldCatalogItem>) {
  const payload = {
    id: item.id,
    shop_setup: item.shopSetup,
    weld_type: item.weldType,
    weld_process: item.weldProcess,
    thickness: item.thickness,
    rate_per_hour: item.ratePerHour ?? 0,
    weight_per_ft: item.weightPerFt ?? 0,
    cost_per_lb: item.costPerLb ?? 0,
    sort_order: item.sortOrder ?? 0,
    is_archived: item.isArchived ?? false,
  };
  const { data, error } = await supabase
    .from('estimating_weld_catalog')
    .upsert(payload, { onConflict: 'id' })
    .select('id, shop_setup, weld_type, weld_process, thickness, rate_per_hour, weight_per_ft, cost_per_lb, sort_order, is_archived')
    .single();
  if (error) throw error;
  return mapWeldRow(data);
}

export async function deleteWeldCatalogItem(id: string) {
  const { error } = await supabase.from('estimating_weld_catalog').delete().eq('id', id);
  if (error) throw error;
}

export async function seedWeldCatalogItems(): Promise<DbWeldCatalogItem[]> {
  const payload = starterWeldCatalog.map((row, index) => ({
    shop_setup: row.shopSetup,
    weld_type: row.weldType,
    weld_process: row.weldProcess,
    thickness: row.thickness,
    rate_per_hour: row.ratePerHour,
    weight_per_ft: row.weightPerFt,
    cost_per_lb: row.costPerLb,
    sort_order: index,
    is_archived: false,
  }));
  const { error } = await supabase.from('estimating_weld_catalog').insert(payload);
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  return listWeldCatalogItems();
}


/* ================= NEW RULE-BASED ESTIMATING ENGINE HELPERS ================= */

export async function getMaterialGroups() {
  const { data, error } = await supabase
    .from("estimating_material_groups")
    .select("*")
    .eq("is_archived", false)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getLaborCodes(materialGroupId: string) {
  const { data, error } = await supabase
    .from("estimating_labor_codes")
    .select("*")
    .eq("material_group_id", materialGroupId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getLaborOperations(laborCodeId: string) {
  const { data, error } = await supabase
    .from("estimating_labor_operations")
    .select("*")
    .eq("labor_code_id", laborCodeId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getLaborFormulas(laborCodeId: string) {
  const { data, error } = await supabase
    .from("estimating_labor_formulas")
    .select("*")
    .eq("labor_code_id", laborCodeId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function createLaborCode(payload: {
  material_group_id: string;
  code: string;
  description: string;
}) {
  const { data, error } = await supabase
    .from("estimating_labor_codes")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addOperation(payload: {
  labor_code_id: string;
  description: string;
  qty: number;
  group_name?: string;
}) {
  const { data, error } = await supabase
    .from("estimating_labor_operations")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addFormula(payload: {
  labor_code_id: string;
  description: string;
  qty: number;
  formula_type: string;
  expression: Record<string, any>;
}) {
  const { data, error } = await supabase
    .from("estimating_labor_formulas")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
