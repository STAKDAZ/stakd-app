import { supabase } from "@/lib/supabase/client";

export type EngineEstimateInput = {
  quantity?: number;
  shape_code?: string;
  size_label?: string;
  length?: number;
  width?: number;
  thickness?: number;
  labor_code?: string;
  holes?: number;
  copes?: number;
  punches?: number;
  stiffeners?: number;
};

export type EngineEstimateResult = {
  processing_hours: number;
  shop_hours: number;
  total_hours: number;
  piece_weight: number;
  total_weight: number;
  breakdown: Record<string, unknown>;
};

function num(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeEval(expression: string, context: Record<string, number>) {
  if (!/^[0-9a-zA-Z_+\-*/().,\s]+$/.test(expression)) return 0;
  const allowed = { ceil: Math.ceil, floor: Math.floor, round: Math.round, max: Math.max, min: Math.min, abs: Math.abs };
  const keys = [...Object.keys(context), ...Object.keys(allowed)];
  const values = [...Object.values(context), ...Object.values(allowed)];
  try {
    const result = Function(...keys, `"use strict"; return (${expression});`)(...values);
    return num(result);
  } catch {
    return 0;
  }
}

export async function calculateEstimateItem(input: EngineEstimateInput): Promise<EngineEstimateResult> {
  const quantity = num(input.quantity, 1) || 1;
  const length = num(input.length);
  const { data: material } = await supabase.from("estimating_material_sizes").select("*, estimating_material_shapes(shape_code, shape_name)").eq("size_label", input.size_label ?? "").maybeSingle();
  const shapeCode = input.shape_code || (material as any)?.estimating_material_shapes?.shape_code || "";
  const { data: laborCode } = await supabase.from("estimating_labor_codes").select("id").eq("code", input.labor_code ?? "").or(`material_shape_code.eq.${shapeCode},material_shape_code.eq.W`).limit(1).maybeSingle();
  const [{ data: formulas }, { data: rates }] = await Promise.all([
    laborCode?.id ? supabase.from("estimating_labor_code_formulas").select("*").eq("labor_code_id", laborCode.id).eq("is_active", true) : Promise.resolve({ data: [] as any[] }),
    supabase.from("estimating_rates").select("*").eq("is_active", true),
  ]);
  const rateValue = (rateCode: string) => num((rates ?? []).find((row: any) => row.rate_code === rateCode)?.rate_value);
  const burnRate = num((rates ?? []).find((row: any) => row.rate_type === "BURN" && (!row.material_shape_code || row.material_shape_code === shapeCode))?.rate_value);
  const weightPerFt = num((material as any)?.weight_per_ft);
  const thickness = num(input.thickness, num((material as any)?.thickness, 0.25));
  const width = num(input.width, num((material as any)?.width, num((material as any)?.flange_width, 0)));
  const context: Record<string, number> = { quantity, length, width, thickness, flange_width: num((material as any)?.flange_width, width || 6), flange_thickness: num((material as any)?.flange_thickness, thickness), web_depth: num((material as any)?.depth, width), perimeter: num((material as any)?.perimeter, length ? length * 12 * 2 : 0), holes: num(input.holes), copes: num(input.copes), punches: num(input.punches), stiffeners: num(input.stiffeners), standard_clip_holes: 4, standard_clip_cost: 10, burn_rate: burnRate, hole_rate: rateValue("HOLE_STD"), fillet_weld_rate: rateValue("FILLET_1_4"), stitch_weld_rate: rateValue("STITCH_1_4"), full_pen_rate: rateValue("FULL_PEN") };
  let processingMinutes = 0;
  let shopMinutes = 0;
  const formulaBreakdown: any[] = [];
  for (const formula of formulas ?? []) {
    const minutes = safeEval(String((formula as any).expression ?? "0"), context) * quantity;
    formulaBreakdown.push({ key: (formula as any).formula_key, label: (formula as any).formula_label, output_group: (formula as any).output_group, minutes });
    if ((formula as any).output_group === "PROCESSING") processingMinutes += minutes;
    if ((formula as any).output_group === "SHOP") shopMinutes += minutes;
  }
  const pieceWeight = weightPerFt * length;
  const totalWeight = pieceWeight * quantity;
  return { processing_hours: processingMinutes / 60, shop_hours: shopMinutes / 60, total_hours: (processingMinutes + shopMinutes) / 60, piece_weight: pieceWeight, total_weight: totalWeight, breakdown: { formulas: formulaBreakdown, material, context } };
}
