import {
  calcPiece,
  n,
  type EstimateSettings,
  type EstimateSummary,
  type JobEstimate,
} from "@/lib/estimating";
import { FULL_FAB_TEMPLATE_BASE64 } from "@/lib/full-fab-template";

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function set(ws: any, cell: string, value: any) {
  ws.getCell(cell).value = value ?? "";
}

function num(value: any, fallback = 0) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function dateValue(value?: string | null) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d;
}

function clearValues(ws: any, cells: string[]) {
  for (const address of cells) ws.getCell(address).value = null;
}

function resetTemplateSummary(ws: any) {
  // Clear example-job values but keep formulas/styles/colors from the Full Fab template.
  clearValues(ws, [
    "H2", "L2",
    "C4", "C5", "L4", "L5",
    "C7", "C8", "C9", "C10", "C11",
    "L7", "L8", "L9", "L10", "L11",
    "E13", "F13", "E14", "F14", "E15", "F15", "E16", "F16", "E17", "F17", "E18", "F18", "F19", "F20",
    "E22", "F22", "E23", "F23", "E24", "F24", "F25",
    "D31", "E31", "D32", "E32", "D33", "E33", "D34", "E34", "D35", "E35", "D36", "E36", "F37",
    "F42", "F43", "F44", "F45", "F46", "F47", "F48", "F49", "F50",
    "E57", "F57", "F58", "D61", "E61", "F62", "F63", "F64", "F65",
  ]);
}

function populateSummary(ws: any, estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  resetTemplateSummary(ws);

  const info: any = estimate.info ?? {};
  const totalWeight = num(summary.totalWeight);
  const materialCost = num(summary.materialCost);
  const dropPct = num(settings.dropPct, 7.5);
  const dropWeight = num(summary.dropWeight, totalWeight * (dropPct / 100));
  const dropCost = num(summary.dropCost, materialCost * (dropPct / 100));
  const labor = summary.laborHours ?? { cut: 0, move: 0, layout: 0, weld: 0, total: 0 };

  set(ws, "H2", dateValue(info.estimateDate));
  set(ws, "L2", `${info.estimateNumber || estimate.jobNumber || ""} `);

  set(ws, "C4", info.recipientCompany || "");
  set(ws, "C5", info.recipientContact || "");
  set(ws, "L4", info.phone || "");
  set(ws, "L5", info.fax || "");

  set(ws, "C7", info.estimateName || estimate.jobName || "");
  set(ws, "C8", info.location || "");
  set(ws, "C9", info.county || "");
  set(ws, "C10", info.groupName || "");
  set(ws, "C11", info.groupName2 || "");
  set(ws, "L7", info.erectorEstimateNumber || "");
  set(ws, "L8", info.taxExempt || "");
  set(ws, "L9", num(info.distanceToJobMiles));
  set(ws, "L10", info.siteCompletion || "");
  set(ws, "L11", info.liquidatedDamages || "");

  // MATERIALS section — preserve the template formulas in H:M.
  set(ws, "E13", totalWeight);
  set(ws, "F13", materialCost);
  set(ws, "E14", dropWeight);
  set(ws, "F14", dropCost);
  set(ws, "E15", num(summary.weldMaterialWeight));
  set(ws, "F15", num(summary.weldMaterialCost));
  set(ws, "E16", num((info as any).shopBoltsEach));
  set(ws, "F16", num((summary as any).shopBoltsCost));
  set(ws, "E17", num(info.fieldBoltsEach));
  set(ws, "F17", num(summary.fieldBoltsCost));
  set(ws, "E18", num((info as any).weldedStudsEach));
  set(ws, "F18", num((summary as any).weldedStudsCost));
  set(ws, "F19", num(summary.buyoutCost));
  set(ws, "F20", num(summary.inboundFreightCost));

  set(ws, "E22", num((summary as any).sandShotWeight));
  set(ws, "F22", num((summary as any).sandShotCost));
  set(ws, "E23", num((summary as any).paintGallons));
  set(ws, "F23", num(summary.paintCost));
  set(ws, "E24", num((summary as any).galvanizingWeight));
  set(ws, "F24", num((summary as any).galvanizingCost));
  set(ws, "F25", num((summary as any).galvanizingFreightCost));

  // LABOR section. Match the template rows: shop / Voortman / plasma / dragon / fabricator / detailing.
  const shopRate = num(settings.weldRatePerHour || settings.moveRatePerHour || settings.cutRatePerHour, 27);
  const cutRate = num(settings.cutRatePerHour, shopRate);
  const layoutRate = num(settings.layoutRatePerHour, shopRate);
  const moveRate = num(settings.moveRatePerHour, shopRate);
  const weldRate = num(settings.weldRatePerHour, shopRate);
  const shopHours = num(labor.weld) + num(labor.move) + num(labor.layout);
  const voortmanHours = num(labor.cut);
  const plasmaHours = num((summary as any).plasmaHours);

  set(ws, "D31", weldRate);
  set(ws, "E31", shopHours);
  set(ws, "D32", cutRate);
  set(ws, "E32", voortmanHours);
  set(ws, "D33", cutRate);
  set(ws, "E33", plasmaHours);
  set(ws, "D34", cutRate);
  set(ws, "E34", 0);
  set(ws, "D35", cutRate);
  set(ws, "E35", 0);
  set(ws, "D36", num((settings as any).detailingRatePerHour));
  set(ws, "E36", num((summary as any).detailingHours));
  set(ws, "F37", num((summary as any).laborForGalvPrepCost));

  // Subcontracts / jobsite.
  set(ws, "F42", num(summary.detailingCost));
  set(ws, "F43", num((summary as any).joistsCost));
  set(ws, "F44", num((summary as any).deckCost));
  set(ws, "F45", num((summary as any).gratingCost));
  set(ws, "E57", num((settings as any).freightPerMile || 8));
  set(ws, "F57", num(summary.jobsiteFreightCost));
  set(ws, "D61", num((settings as any).erectionRatePerHour));
  set(ws, "E61", num((summary as any).erectionHours));
  set(ws, "F62", num(summary.erectionCost));

  // Keep the template's efficiency field live but feed the current setting.
  set(ws, "E86", num(settings.efficiencyPct, 75) / 100);
}

function lineRows(estimate: JobEstimate, settings: EstimateSettings) {
  return estimate.pieces.map((piece) => {
    const calc = calcPiece(piece, settings, estimate.pieces);
    return {
      page: piece.page,
      item: piece.item,
      partNumber: piece.partNumber,
      qty: piece.quantity,
      mainMultiplier: calc.mainMultiplier,
      effectiveQty: calc.effectiveQuantity,
      main: piece.isMainPiece ? "Y" : "",
      linkedTo: piece.mainPieceId ? estimate.pieces.find((row) => row.id === piece.mainPieceId)?.item ?? "" : "",
      laborCode: piece.extraCode,
      category: piece.category,
      subCategory: piece.subCategory,
      sequence: piece.sequence,
      shape: piece.shape,
      description: piece.description,
      grade: piece.grade,
      lengthFt: calc.lengthFeet,
      weightEach: calc.weightPerPiece,
      totalWeight: calc.totalWeight,
      weld: calc.weldSize,
      cutHours: calc.cutHours,
      moveHours: calc.moveHours,
      layoutHours: calc.layoutHours,
      weldHours: calc.weldHours,
      totalHours: calc.totalHours,
      lineTotal: calc.lineTotal,
      notes: piece.notes,
    };
  });
}

function populateExportedData(wb: any, estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  let ws = wb.getWorksheet("ExportedData");
  if (!ws) ws = wb.addWorksheet("ExportedData");

  // Clear current template data contents only. Preserve basic sheet object.
  ws.eachRow((row: any) => row.eachCell((cell: any) => { cell.value = null; }));

  const now = new Date();
  set(ws, "A1", `${estimate.jobNumber || estimate.info?.estimateNumber || "Estimate"} - `);
  set(ws, "B1", now);
  set(ws, "A3", "Summary");
  set(ws, "C3", estimate.pieces.length);

  const data: any[][] = [
    ["Total Material Weight (#)", summary.totalWeight],
    ["Total Material Cost", summary.materialCost, "$"],
    ["Drop Percentage", settings.dropPct],
    ["Drop Weight", summary.dropWeight],
    ["Drop Cost", summary.dropCost],
    ["Buyout Cost", summary.buyoutCost],
    ["Inbound Freight Cost", summary.inboundFreightCost],
    ["Jobsite Freight Distance (Miles)", estimate.info?.distanceToJobMiles ?? 0],
    ["Jobsite Freight Cost", summary.jobsiteFreightCost, (settings as any).freightPerMile ?? 8],
    ["Galvanizing Weight (#)", (summary as any).galvanizingWeight ?? 0],
    ["Galvanizing Cost", (summary as any).galvanizingCost ?? 0],
    ["Freight to & from Galv Cost", (summary as any).galvanizingFreightCost ?? 0],
    ["Labor for Galv Prep Cost", (summary as any).laborForGalvPrepCost ?? 0],
    ["Total Weld Material Weight (#)", summary.weldMaterialWeight],
    ["Total Weld Material Cost", summary.weldMaterialCost, 2],
    ["DC740 Ferro Gray (Gals)", (summary as any).paintGallons ?? 0],
    ["DC740 Ferro Gray Cost", summary.paintCost],
    ["MacroPoxy Primer (Gals)", 0],
    ["MacroPoxy Primer Cost", 0],
    ["Sand/Shot Weight (#)", (summary as any).sandShotWeight ?? 0],
    ["Sand/Shot Cost", (summary as any).sandShotCost ?? 0],
    ["Shop Bolts", (estimate.info as any)?.shopBoltsEach ?? 0],
    ["Shop Bolts Cost", (summary as any).shopBoltsCost ?? 0],
    ["Field Bolts", estimate.info?.fieldBoltsEach ?? 0, "Welded Studs", (estimate.info as any)?.weldedStudsEach ?? 0],
    ["Field Bolts Cost", summary.fieldBoltsCost, "Welded Studs Cost", (summary as any).weldedStudsCost ?? 0],
    ["Detailing Cost", summary.detailingCost],
    ["Detailing Labor (Hrs)", (summary as any).detailingHours ?? 0],
    ["Detailing Labor Manhour Rate", (settings as any).detailingRatePerHour ?? 0],
    ["Detailing Labor Cost", 0],
    ["Total Shop Labor (Hrs)", summary.laborHours?.total ?? 0, "Cut", summary.laborHours?.cut ?? 0, "Move", summary.laborHours?.move ?? 0, "Layout", summary.laborHours?.layout ?? 0, "Weld", summary.laborHours?.weld ?? 0],
    ["Shop Labor Hourly Rate", settings.weldRatePerHour ?? 27],
    ["Total Shop Labor Cost", summary.laborCost],
    ["Shop Overhead Percentage", settings.shopOverheadPct],
    ["Shop Overhead Cost", summary.overheadCost],
    ["Erecting Cost", summary.erectionCost],
    ["Erecting Labor (Hrs)", (summary as any).erectionHours ?? 0],
    ["Erecting Labor Hourly Rate", (settings as any).erectionRatePerHour ?? 0],
    ["Erecting Labor Cost", summary.erectionCost],
    ["Total Job Cost", summary.subtotalBeforeSales],
    ["Sales & Administration Percentage", settings.salesAdminPct],
    ["Sales & Administration Cost", summary.salesAdminCost],
    ["Total Cost Including Sales & Administration", (summary as any).subtotalBeforeProfit ?? 0],
    ["Profit Percentage", settings.profitPct],
    ["Profit Cost", summary.profitCost],
    ["Total Cost Including Profit", summary.grandTotal],
    [],
    ["Bid Date", estimate.info?.estimateDate || new Date().toISOString().slice(0, 10)],
    ["Tonnage", summary.totalTons],
    ["Labor (Hrs/Ton)", summary.totalTons ? (summary.laborHours?.total ?? 0) / summary.totalTons : 0],
    ["Shop Efficiency Percentage", settings.efficiencyPct],
    [],
    ["Location", estimate.info?.location || ""],
    ["Group Name", estimate.info?.groupName || ""],
    ["Group Name 2", estimate.info?.groupName2 || ""],
    ["PCP", 0],
  ];

  data.forEach((row, i) => {
    row.forEach((value, j) => set(ws, `${String.fromCharCode(65 + j)}${i + 4}`, value));
  });

  const start = 62;
  const headers = ["Page", "Item", "Part #", "Qty", "Main Mult", "Eff Qty", "Main", "Linked To", "Code", "Category", "Sub-Category", "Sequence", "Shape", "Description", "Grade", "Length (ft)", "Weight/Pc", "Total Weight", "Weld", "Cut Hrs", "Move Hrs", "Layout Hrs", "Weld Hrs", "Total Hrs", "Line Total", "Notes"];
  headers.forEach((h, idx) => set(ws, `${String.fromCharCode(65 + idx)}${start}`, h));
  lineRows(estimate, settings).forEach((r, i) => {
    const vals = [r.page, r.item, r.partNumber, r.qty, r.mainMultiplier, r.effectiveQty, r.main, r.linkedTo, r.laborCode, r.category, r.subCategory, r.sequence, r.shape, r.description, r.grade, r.lengthFt, r.weightEach, r.totalWeight, r.weld, r.cutHours, r.moveHours, r.layoutHours, r.weldHours, r.totalHours, r.lineTotal, r.notes];
    vals.forEach((v, idx) => set(ws, `${String.fromCharCode(65 + idx)}${start + 1 + i}`, v));
  });

  ws.columns = headers.map((h: string) => ({ width: Math.max(10, Math.min(24, h.length + 2)) }));
  ws.getColumn(14).width = 30;
  ws.getColumn(26).width = 30;
}

export async function buildFullFabWorkbookBlob(estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(base64ToArrayBuffer(FULL_FAB_TEMPLATE_BASE64));

  workbook.creator = "STAKD App";
  workbook.lastModifiedBy = "STAKD App";
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summarySheet = workbook.getWorksheet("Summary") ?? workbook.worksheets[0];
  populateSummary(summarySheet, estimate, summary, settings);
  populateExportedData(workbook, estimate, summary, settings);

  // Make sure the exact-template sheets are the primary sheets. Remove old generated sheets if present.
  ["Line Items", "Labor Breakdown", "Material Summary"].forEach((name) => {
    const sheet = workbook.getWorksheet(name);
    if (sheet) workbook.removeWorksheet(sheet.id);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
