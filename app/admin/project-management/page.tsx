"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type JobRow = {
  id: string;
  job_number: string | null;
  job_name: string | null;
  status: string | null;
  pm_status: string | null;
  projected_finish_date: string | null;
  fabrication_due_date: string | null;
  percent_complete: number | null;
  po_number: string | null;
  project_notes: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  outsourced_to: string | null;
  is_archived: boolean | null;
};

type JobPmDetail = {
  id: string;
  job_id: string;
  sold_to_name: string | null;
  sold_to_address: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  customer_po: string | null;
  internal_po: string | null;
  notes: string | null;
};

type JobDueDate = {
  id: string;
  job_id: string;
  due_date: string;
  label: string | null;
  quantity: number | null;
  sort_order: number | null;
  is_completed: boolean | null;
  completed_at: string | null;
};

type ShippingLoad = {
  id: string;
  job_id: string;
  load_number: string;
  ship_date: string | null;
  ship_to_name: string | null;
  ship_to_address: string | null;
  po_number: string | null;
  assembly_quantity: number | null;
  weight_loaded_lbs: number | null;
  ticket_notes: string | null;
  shipping_signature_name: string | null;
  received_signature_name: string | null;
};

type ShippingLoadItem = {
  id: string;
  shipping_load_id: string;
  line_no: number;
  mark: string;
  sequence: string | null;
  quantity: number | null;
  weight_lbs: number | null;
  description: string | null;
  finish: string | null;
};

type QcChecklist = {
  id: string;
  job_id: string;
  shipping_load_id: string | null;
  checklist_type: "Final Release Checklist" | "Shipping Release Checklist";
  checklist_date: string;
  status: string;
  inspector_name: string | null;
  approved_by: string | null;
  notes: string | null;
};

type QcChecklistItem = {
  id: string;
  checklist_id: string;
  line_no: number;
  item_label: string;
  is_checked: boolean;
  note: string | null;
};

type ImportBatch = {
  id: string;
  job_id: string | null;
  file_type: "xml" | "kss";
  original_filename: string;
  imported_at: string;
  source_application: string | null;
  source_application_version: string | null;
  plugin_version: string | null;
  source_project_number: string | null;
  source_project_name: string | null;
  source_file_creation_date: string | null;
  status: string;
  error_text: string | null;
};

type ImportItem = {
  id: string;
  import_batch_id: string;
  job_id: string | null;
  drawing_number: string | null;
  drawing_title: string | null;
  drawing_category: string | null;
  drawing_revision: string | null;
  assembly_mark: string | null;
  sequence: string | null;
  phase: string | null;
  quantity: number | null;
  weight_lbs: number | null;
  dimensions: string | null;
  grade: string | null;
  finish: string | null;
  description: string | null;
};

type Subcontractor = {
  id: string;
  name: string;
  logo_url: string | null;
  is_archived: boolean | null;
};

type JobSummary = JobRow & {
  load_count: number;
  open_qc_count: number;
};

type ShippingForm = {
  id?: string;
  load_number: string;
  ship_date: string;
  ship_to_name: string;
  ship_to_address: string;
  po_number: string;
  shipping_signature_name: string;
  received_signature_name: string;
  ticket_notes: string;
};

type ShippingItemDraft = {
  id: string;
  mark: string;
  quantity: string;
  weight_lbs: string;
  description: string;
  sequence: string;
  finish: string;
  unit_weight_lbs?: number | null;
};

type DueDateDraft = {
  id?: string;
  due_date: string;
  label: string;
  quantity: string;
  is_completed: boolean;
};

type JobDetailDraft = {
  pm_status: string;
  fabrication_due_date: string;
  percent_complete: string;
  project_notes: string;
  ship_to_name: string;
  ship_to_address: string;
  sold_to_name: string;
  sold_to_address: string;
  customer_po: string;
  internal_po: string;
  notes: string;
};

type ParsedImportHeader = {
  sourceApplication: string;
  sourceApplicationVersion: string;
  pluginVersion: string;
  fileCreationDate: string;
  projectNumber: string;
  projectName: string;
};

type ParsedImportItem = Omit<
  ImportItem,
  "id" | "import_batch_id" | "job_id"
>;

type ParsedImport = {
  header: ParsedImportHeader;
  items: ParsedImportItem[];
};

type PcTab =
  | "Load Tracking"
  | "Piece Tracking"
  | "Work Packages"
  | "Review"
  | "Dashboards"
  | "History of Changes"
  | "Modify Data"
  | "Export"
  | "Reports";

const PM_STATUSES = [
  "Not Started",
  "Detailing",
  "Approved for Fabrication",
  "Fabricating",
  "At Subcontractor",
  "QC Hold",
  "Ready to Ship",
  "Shipped",
  "Closed",
] as const;

const PRODUCTION_CONTROL_TABS: PcTab[] = [
  "Load Tracking",
  "Piece Tracking",
  "Work Packages",
  "Review",
  "Dashboards",
  "History of Changes",
  "Modify Data",
  "Export",
  "Reports",
];

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return value;
}

function fmtNum(value: number | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "0";
}

function tone(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "closed" || s === "shipped" || s === "applied") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "ready to ship" || s === "approved for fabrication") return "border-sky-200 bg-sky-50 text-sky-700";
  if (s === "qc hold" || s === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (s === "fabricating" || s === "at subcontractor" || s === "detailing" || s === "open") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function normalizeMark(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function safeText(node: Element | null | undefined) {
  return node?.textContent?.trim() || "";
}

function readTag(root: Document | Element, ...tags: string[]) {
  for (const tag of tags) {
    const value = safeText(root.getElementsByTagName(tag)[0]);
    if (value) return value;
  }
  return "";
}

function readAttr(root: Element | null | undefined, ...attrs: string[]) {
  if (!root) return "";
  for (const attr of attrs) {
    const value = root.getAttribute(attr)?.trim();
    if (value) return value;
  }
  return "";
}

function toNumber(value: string | null | undefined, fallback = 0) {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/#/g, "")
    .replace(/lbs?/gi, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function ensureLbs(value: number, unitHint?: string) {
  const hint = (unitHint || "").toLowerCase();
  if (!Number.isFinite(value)) return 0;
  if (hint.includes("kg")) return Number(value * 2.20462);
  return Number(value);
}

function mmToFeet(mm: number) {
  return Number.isFinite(mm) ? mm / 304.8 : 0;
}

function fractionToNumber(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  if (raw.includes("-")) {
    const [whole, frac] = raw.split("-");
    return toNumber(whole, 0) + fractionToNumber(frac);
  }
  if (raw.includes("/")) {
    const [num, den] = raw.split("/");
    const n = Number(num);
    const d = Number(den);
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : 0;
  }
  return toNumber(raw, 0);
}

function parseDimInches(value: string) {
  return value
    .toUpperCase()
    .replace(/ /g, "")
    .split("X")
    .map((part) => fractionToNumber(part));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function estimateKssWeightLbs(shape: string | null | undefined, dimension: string | null | undefined, lengthMm: number, quantity: number) {
  const shapeCode = (shape || "").trim().toUpperCase();
  const dim = (dimension || "").trim().toUpperCase().replace(/ /g, "");
  const qty = Math.max(quantity || 1, 1);
  const lengthFt = mmToFeet(lengthMm);
  if (!lengthFt || !dim) return 0;

  let weightPerFt = 0;

  if (["W", "S", "HP", "M", "C", "MC", "WT", "ST", "MT"].includes(shapeCode)) {
    const parts = dim.split("X");
    weightPerFt = toNumber(parts[parts.length - 1], 0);
  } else if (shapeCode === "L") {
    const [leg1, leg2, thickness] = parseDimInches(dim);
    if (leg1 > 0 && leg2 > 0 && thickness > 0) {
      weightPerFt = 3.4032 * thickness * (leg1 + leg2 - thickness);
    }
  } else if (shapeCode === "PL") {
    const [thickness, width] = parseDimInches(dim);
    if (thickness > 0 && width > 0) {
      weightPerFt = 3.4 * thickness * width;
    }
  } else if (shapeCode === "HSS" || shapeCode === "TS") {
    const [depth, width, thickness] = parseDimInches(dim);
    if (depth > 0 && width > 0 && thickness > 0 && depth > 2 * thickness && width > 2 * thickness) {
      const area = depth * width - (depth - 2 * thickness) * (width - 2 * thickness);
      weightPerFt = area * 3.4;
    }
  } else if (shapeCode == "PIPE") {
    const [od, thickness] = parseDimInches(dim);
    if (od > 0 && thickness > 0 && od > 2 * thickness) {
      const area = Math.PI / 4 * (od ** 2 - (od - 2 * thickness) ** 2);
      weightPerFt = area * 3.4;
    }
  }

  if (!weightPerFt || weightPerFt <= 0) return 0;
  return round2(weightPerFt * lengthFt * qty);
}

function nextLoadNumber(loads: ShippingLoad[]) {
  const maxExisting = loads.reduce((max, load) => {
    const n = parseInt(String(load.load_number || "").trim(), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return String(maxExisting + 1);
}

function makeDueDateDraft(date = "", index = 0): DueDateDraft {
  return {
    due_date: date,
    label: index ? `Release ${index + 1}` : "Final due date",
    quantity: "",
    is_completed: false,
  };
}

function makeLineDraft(): ShippingItemDraft {
  return {
    id: crypto.randomUUID(),
    mark: "",
    quantity: "1",
    weight_lbs: "",
    description: "",
    sequence: "",
    finish: "",
    unit_weight_lbs: null,
  };
}

function cleanNumberString(value: number) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function isBlankShippingDraft(row: ShippingItemDraft) {
  return !row.mark.trim() && !row.quantity.trim() && !row.weight_lbs.trim() && !row.description.trim() && !row.sequence.trim() && !row.finish.trim();
}

function updateShippingQuantity(row: ShippingItemDraft, quantity: string): ShippingItemDraft {
  const next: ShippingItemDraft = { ...row, quantity };
  const qty = Number(quantity || 0);
  if (row.unit_weight_lbs && Number.isFinite(row.unit_weight_lbs) && qty >= 0) {
    next.weight_lbs = qty ? cleanNumberString(row.unit_weight_lbs * qty) : "";
  }
  return next;
}

function parseXml(text: string): ParsedImport {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const parseError = xml.getElementsByTagName("parsererror")[0]?.textContent;
  if (parseError) throw new Error("XML could not be read. Make sure this is a valid Tekla XML export.");

  const header: ParsedImportHeader = {
    sourceApplication: readTag(xml, "SourceApplication", "Application", "ProgramName") || "Tekla PowerFab",
    sourceApplicationVersion: readTag(xml, "SourceApplicationVersion", "ApplicationVersion"),
    pluginVersion: readTag(xml, "PluginVersion"),
    fileCreationDate: readTag(xml, "FileCreationDate", "ExportDate", "CreatedDate"),
    projectNumber: readTag(xml, "ProjectNumber", "JobNumber", "ProjectNo"),
    projectName: readTag(xml, "ProjectName", "JobName", "ProjectDescription"),
  };

  const assemblies = Array.from(xml.getElementsByTagName("Assembly"));
  const rootParts = Array.from(xml.getElementsByTagName("Part"));
  const items: ParsedImportItem[] = [];

  const pushItem = (item: ParsedImportItem) => {
    if (!(item.assembly_mark || item.drawing_number || item.description || item.dimensions)) return;
    items.push({
      drawing_number: item.drawing_number || null,
      drawing_title: item.drawing_title || null,
      drawing_category: item.drawing_category || null,
      drawing_revision: item.drawing_revision || null,
      assembly_mark: item.assembly_mark || null,
      sequence: item.sequence || null,
      phase: item.phase || null,
      quantity: item.quantity ?? 1,
      weight_lbs: Number.isFinite(Number(item.weight_lbs)) ? Number(Number(item.weight_lbs).toFixed(2)) : 0,
      dimensions: item.dimensions || null,
      grade: item.grade || null,
      finish: item.finish || null,
      description: item.description || null,
    });
  };

  for (const assembly of assemblies) {
    const assemblyMark = readTag(assembly, "AssemblyMark", "MainMark", "Mark", "MemberNumber");
    const drawingNumber = readTag(assembly, "DrawingNumber", "DrawingNo");
    const drawingTitle = readTag(assembly, "DrawingTitle", "Description", "AssemblyDescription");
    const drawingRevision = readTag(assembly, "RevisionNumber", "Revision");
    const sequence = readTag(assembly, "SequenceNumber", "Sequence", "LotNumber");
    const phase = Array.from(assembly.getElementsByTagName("OtherField")).find(
      (node) => readAttr(node, "FieldName", "fieldname").toLowerCase() === "phase name"
    )?.textContent?.trim() || readTag(assembly, "Phase", "PhaseName");
    const quantity = toNumber(readTag(assembly, "AssemblyQuantity", "Quantity", "Qty"), 1);

    const firstPart =
      assembly.getElementsByTagName("AssemblyPart")[0] ||
      assembly.getElementsByTagName("Part")[0] ||
      assembly.getElementsByTagName("SinglePart")[0] ||
      null;

    const assemblyWeightRaw =
      readTag(assembly, "Weight", "WeightEach", "TotalWeight") ||
      readTag(firstPart || assembly, "Weight", "WeightEach", "TotalWeight");
    const assemblyUnit = readTag(assembly, "WeightUnit", "Unit") || readTag(firstPart || assembly, "WeightUnit", "Unit");
    const assemblyWeight = ensureLbs(toNumber(assemblyWeightRaw, 0), assemblyUnit) * Math.max(quantity || 1, 1);

    pushItem({
      drawing_number: drawingNumber,
      drawing_title: drawingTitle,
      drawing_category: "MAIN",
      drawing_revision: drawingRevision,
      assembly_mark: assemblyMark,
      sequence,
      phase,
      quantity: Math.max(quantity || 1, 1),
      weight_lbs: assemblyWeight,
      dimensions: readTag(firstPart || assembly, "Dimensions", "Size", "Dimension"),
      grade: readTag(firstPart || assembly, "Grade", "MaterialGrade", "Material"),
      finish: readTag(assembly, "Finish", "Coating"),
      description: readTag(firstPart || assembly, "Shape", "SectionSize", "Description") || drawingTitle,
    });

    const partNodes = Array.from(assembly.children).filter((child) => {
      const tag = child.tagName.toLowerCase();
      return tag.includes("part") || tag.includes("assemblypart") || tag.includes("singlepart");
    });

    for (const part of partNodes) {
      const partQty = toNumber(readTag(part, "Quantity", "Qty", "PartQuantity"), quantity || 1);
      const partWeightRaw = readTag(part, "Weight", "WeightEach", "TotalWeight");
      const partUnit = readTag(part, "WeightUnit", "Unit");
      pushItem({
        drawing_number: drawingNumber,
        drawing_title: drawingTitle,
        drawing_category: "PART",
        drawing_revision: drawingRevision,
        assembly_mark: readTag(part, "PieceMark", "PartMark", "SinglePartMark", "Mark") || assemblyMark,
        sequence,
        phase,
        quantity: Math.max(partQty || 1, 1),
        weight_lbs: ensureLbs(toNumber(partWeightRaw, 0), partUnit) * Math.max(partQty || 1, 1),
        dimensions: readTag(part, "Dimensions", "Size", "Dimension", "Length"),
        grade: readTag(part, "Grade", "MaterialGrade", "Material"),
        finish: readTag(part, "Finish", "Coating"),
        description: readTag(part, "Shape", "SectionSize", "Description", "PartDescription"),
      });
    }
  }

  if (items.length === 0 && rootParts.length > 0) {
    for (const part of rootParts.slice(0, 1200)) {
      const qty = toNumber(readTag(part, "Quantity", "Qty"), 1);
      const weightRaw = readTag(part, "Weight", "WeightEach", "TotalWeight");
      pushItem({
        drawing_number: readTag(part, "DrawingNumber", "DrawingNo"),
        drawing_title: readTag(part, "DrawingTitle", "Description"),
        drawing_category: "PART",
        drawing_revision: readTag(part, "RevisionNumber", "Revision"),
        assembly_mark: readTag(part, "PieceMark", "PartMark", "SinglePartMark", "Mark"),
        sequence: readTag(part, "SequenceNumber", "Sequence", "LotNumber"),
        phase: readTag(part, "Phase", "PhaseName"),
        quantity: Math.max(qty || 1, 1),
        weight_lbs: ensureLbs(toNumber(weightRaw, 0), readTag(part, "WeightUnit", "Unit")) * Math.max(qty || 1, 1),
        dimensions: readTag(part, "Dimensions", "Size", "Dimension", "Length"),
        grade: readTag(part, "Grade", "MaterialGrade", "Material"),
        finish: readTag(part, "Finish", "Coating"),
        description: readTag(part, "Shape", "SectionSize", "Description", "PartDescription"),
      });
    }
  }

  return { header, items: items.slice(0, 2000) };
}

function parseKss(text: string): ParsedImport {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerLine = lines.find((line) => line.startsWith("KISS,")) || "";
  const fileHeaderLine = lines.find((line) => line.startsWith("H,")) || "";
  const headerParts = headerLine.split(",");
  const fileHeaderParts = fileHeaderLine.split(",");

  const items: ParsedImportItem[] = [];

  const header: ParsedImportHeader = {
    sourceApplication: headerParts[2] || "Tekla Structures",
    sourceApplicationVersion: headerParts[1] || "",
    pluginVersion: "",
    fileCreationDate: [fileHeaderParts[4], fileHeaderParts[5]].filter(Boolean).join(" "),
    projectNumber: fileHeaderParts[1] || "",
    projectName: fileHeaderParts[2] || "",
  };

  const pushBlockItems = (blockLines: string[]) => {
    if (!blockLines.length) return;

    const blockItems: ParsedImportItem[] = [];
    const sequenceValues = new Set<string>();

    for (const line of blockLines) {
      const parts = line.split(",");
      const tag = (parts[0] || "").toUpperCase();

      if (tag === "S") {
        const seq = (parts[1] || "").trim();
        const seqQty = (parts[2] || "").trim();
        if (seq && seqQty) sequenceValues.add(`${seq}:${seqQty}`);
        else if (seq) sequenceValues.add(seq);
        continue;
      }

      if (tag !== "D") continue;

      const drawingNumber = (parts[1] || "").trim() || null;
      const drawingRevision = (parts[2] || "").trim() || null;
      const mainMark = (parts[3] || "").trim();
      const pieceMark = (parts[4] || "").trim();
      const quantity = Math.max(toNumber(parts[5], 1), 1);
      const shape = (parts[6] || "").trim();
      const dimension = (parts[7] || "").trim();
      const grade = (parts[8] || "").trim() || null;
      const lengthRaw = (parts[9] || "").trim();
      const finish = (parts[10] || "").trim() || null;
      const description = (parts[11] || "").trim() || null;
      const lengthMm = toNumber(lengthRaw, 0);

      const normalizedPiece = pieceMark.toUpperCase();
      const normalizedMain = mainMark.toUpperCase();
      const category = pieceMark && normalizedPiece === normalizedMain ? "MAIN" : "PART";

      const mark = pieceMark || mainMark || drawingNumber || "";
      const dimensions = [shape, dimension].filter(Boolean).join(" ").trim() || null;
      const numericLength = lengthMm;
      const fallbackDescription = [description, shape, dimension].filter(Boolean).join(" ").trim() || null;
      const estimatedWeight = estimateKssWeightLbs(shape, dimension, lengthMm, quantity);

      blockItems.push({
        drawing_number: drawingNumber,
        drawing_title: mainMark || drawingNumber,
        drawing_category: category,
        drawing_revision: drawingRevision,
        assembly_mark: mark || null,
        sequence: null,
        phase: null,
        quantity,
        weight_lbs: estimatedWeight,
        dimensions,
        grade,
        finish,
        description: fallbackDescription,
      });

      if (category === "MAIN" && numericLength > 0 && !description) {
        blockItems[blockItems.length - 1].description = shape || "MAIN";
      }
    }

    const sequence = Array.from(sequenceValues).join(", ") || null;
    for (const item of blockItems) {
      item.sequence = sequence;
      if (item.assembly_mark || item.drawing_number || item.description || item.dimensions) {
        items.push(item);
      }
    }
  };

  let currentBlock: string[] = [];
  for (const line of lines) {
    if (line === "*") {
      pushBlockItems(currentBlock);
      currentBlock = [];
      continue;
    }
    if (line.startsWith("KISS,") || line.startsWith("H,")) continue;
    currentBlock.push(line);
  }
  pushBlockItems(currentBlock);

  return {
    header,
    items: items.slice(0, 4000),
  };
}

function buildPrintHtml({
  job,
  pmDetail,
  shippingForm,
  items,
}: {
  job: JobRow;
  pmDetail: JobPmDetail | null;
  shippingForm: ShippingForm;
  items: ShippingItemDraft[];
}) {
  const validItems = items.filter((item) => item.mark.trim());
  const totalWeight = validItems.reduce((sum, item) => sum + Number(item.weight_lbs || 0), 0);
  const rows = validItems
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${item.mark || ""}</td>
          <td>${item.quantity || ""}</td>
          <td>${item.weight_lbs || ""}</td>
          <td>${item.sequence || ""}</td>
          <td>${item.finish || ""}</td>
          <td>${item.description || ""}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <title>Shipping Ticket</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px; }
    .logo { width: 90px; }
    h1 { margin: 0; font-size: 26px; }
    .meta { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .box { border:1px solid #d4d4d8; border-radius: 10px; padding: 10px 12px; min-height: 62px; }
    .label { font-size: 11px; color:#6b7280; text-transform: uppercase; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border:1px solid #d4d4d8; padding: 8px; font-size: 12px; text-align:left; }
    th { background: #f4f4f5; }
    .totals { display:flex; justify-content:flex-end; margin-top: 14px; }
    .total-box { border:1px solid #111827; border-radius: 10px; padding: 10px 14px; min-width: 220px; font-size: 16px; font-weight: 700; text-align:right; }
    .signatures { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 30px; }
    .line { border-top:1px solid #111827; margin-top: 44px; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="/stakd-logo.png" class="logo" />
      <h1>STAKD Shipping Ticket</h1>
      <div>${job.job_number || ""} ${job.job_name || ""}</div>
    </div>
    <div style="text-align:right">
      <div><strong>Load Number:</strong> ${shippingForm.load_number}</div>
      <div><strong>Ship Date:</strong> ${shippingForm.ship_date || ""}</div>
      <div><strong>PO:</strong> ${shippingForm.po_number || pmDetail?.customer_po || job.po_number || ""}</div>
    </div>
  </div>

  <div class="meta">
    <div class="box"><div class="label">Job Name</div>${job.job_name || ""}</div>
    <div class="box"><div class="label">Ship To</div>${shippingForm.ship_to_name || pmDetail?.ship_to_name || job.ship_to_name || ""}</div>
    <div class="box"><div class="label">Ship To Address</div>${shippingForm.ship_to_address || pmDetail?.ship_to_address || job.ship_to_address || ""}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Mark</th>
        <th>Qty</th>
        <th>Weight</th>
        <th>Sequence</th>
        <th>Finish</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7">No line items entered.</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-box">Total Weight: ${totalWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} lbs</div>
  </div>

  <div class="signatures">
    <div>
      <div class="line">Shipping Signature: ${shippingForm.shipping_signature_name || ""}</div>
    </div>
    <div>
      <div class="line">Receiving Signature: ${shippingForm.received_signature_name || ""}</div>
    </div>
  </div>
</body>
</html>`;
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <p className="mt-2">
        This menu is on the production control bar now. Load Tracking is the live workspace first, && the rest can be wired up next.
      </p>
    </div>
  );
}

function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthDays(month: string) {
  const [year, rawMonth] = month.split("-").map(Number);
  const first = new Date(year, rawMonth - 1, 1);
  const days: Date[] = [];
  const startOffset = first.getDay();
  for (let i = 0; i < startOffset; i++) days.push(new Date(year, rawMonth - 1, 1 - startOffset + i));
  const last = new Date(year, rawMonth, 0).getDate();
  for (let day = 1; day <= last; day++) days.push(new Date(year, rawMonth - 1, day));
  while (days.length % 7 !== 0) days.push(new Date(year, rawMonth - 1, days.length - startOffset + 1));
  return days;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthLabel(month: string) {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Date(year, rawMonth - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function shiftMonth(month: string, delta: number) {
  const [year, rawMonth] = month.split("-").map(Number);
  const d = new Date(year, rawMonth - 1 + delta, 1);
  return d.toISOString().slice(0, 7);
}

function dueHealth(job: Pick<JobSummary, "fabrication_due_date" | "projected_finish_date" | "percent_complete" | "pm_status">) {
  const complete = Number(job.percent_complete ?? 0);
  const status = (job.pm_status || "").toLowerCase();
  if (complete >= 100 || status === "closed" || status === "shipped") return { label: "Done", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  const date = parseLocalDate(job.fabrication_due_date || job.projected_finish_date);
  if (!date) return { label: "No date", cls: "border-slate-200 bg-slate-50 text-slate-600" };
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: Math.abs(diff) + " days late", cls: "border-red-200 bg-red-50 text-red-700" };
  if (diff <= 5) return { label: diff + " day" + (diff === 1 ? "" : "s") + " remaining", cls: "border-amber-300 bg-amber-50 text-amber-700" };
  return { label: diff + " day" + (diff === 1 ? "" : "s") + " remaining", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

export default function ProjectManagementPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loadsByJob, setLoadsByJob] = useState<Record<string, ShippingLoad[]>>({});
  const [loadItemsByLoad, setLoadItemsByLoad] = useState<Record<string, ShippingLoadItem[]>>({});
  const [qcByJob, setQcByJob] = useState<Record<string, QcChecklist[]>>({});
  const [qcItemsByChecklist, setQcItemsByChecklist] = useState<Record<string, QcChecklistItem[]>>({});
  const [pmDetailsByJob, setPmDetailsByJob] = useState<Record<string, JobPmDetail>>({});
  const [dueDatesByJob, setDueDatesByJob] = useState<Record<string, JobDueDate[]>>({});
  const [multipleDueDates, setMultipleDueDates] = useState(false);
  const [dueDateDrafts, setDueDateDrafts] = useState<DueDateDraft[]>([]);
  const [importsByJob, setImportsByJob] = useState<Record<string, ImportBatch[]>>({});
  const [importItemsByBatch, setImportItemsByBatch] = useState<Record<string, ImportItem[]>>({});
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedImportBatchIds, setSelectedImportBatchIds] = useState<string[]>([]);
  const [activePcTab, setActivePcTab] = useState<PcTab>("Load Tracking");
  const [importSearch, setImportSearch] = useState("");
  const [loadSearch, setLoadSearch] = useState("");
  const [loadSequenceFilter, setLoadSequenceFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showOpenQc, setShowOpenQc] = useState(false);
  const [showLateJobs, setShowLateJobs] = useState(false);
  const [jobDraft, setJobDraft] = useState<JobDetailDraft | null>(null);
  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    load_number: "",
    ship_date: "",
    ship_to_name: "",
    ship_to_address: "",
    po_number: "",
    shipping_signature_name: "",
    received_signature_name: "",
    ticket_notes: "",
  });
  const [shippingItems, setShippingItems] = useState<ShippingItemDraft[]>([]);
  const [quantityMultiplier, setQuantityMultiplier] = useState("2");
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const xmlInputRef = useRef<HTMLInputElement | null>(null);
  const kssInputRef = useRef<HTMLInputElement | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );
  const selectedJobPmDetail = selectedJobId ? pmDetailsByJob[selectedJobId] || null : null;
  const selectedJobLoads = selectedJobId ? loadsByJob[selectedJobId] || [] : [];
  const selectedJobDueDates = selectedJobId ? dueDatesByJob[selectedJobId] || [] : [];
  const selectedJobQc = selectedJobId ? qcByJob[selectedJobId] || [] : [];

  useEffect(() => {
    if (!selectedJobId) return;
    setShippingForm((prev) => {
      if (prev.load_number.trim()) return prev;
      return { ...prev, load_number: nextLoadNumber(selectedJobLoads) };
    });
  }, [selectedJobId, selectedJobLoads]);
  const selectedJobImports = selectedJobId ? importsByJob[selectedJobId] || [] : [];

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, loadsRes, loadItemsRes, qcRes, qcItemsRes, pmDetailsRes, dueDatesRes, importsRes, importItemsRes, subsRes] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, job_number, job_name, status, pm_status, projected_finish_date, fabrication_due_date, percent_complete, po_number, project_notes, ship_to_name, ship_to_address, outsourced_to, is_archived"
          )
          .eq("is_archived", false)
          .eq("status", "Won")
          .order("fabrication_due_date", { ascending: true, nullsFirst: false })
          .order("job_number", { ascending: true }),
        supabase
          .from("shipping_loads")
          .select(
            "id, job_id, load_number, ship_date, ship_to_name, ship_to_address, po_number, assembly_quantity, weight_loaded_lbs, ticket_notes, shipping_signature_name, received_signature_name"
          )
          .order("ship_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("shipping_load_items")
          .select("id, shipping_load_id, line_no, mark, sequence, quantity, weight_lbs, description, finish")
          .order("line_no", { ascending: true }),
        supabase
          .from("qc_checklists")
          .select("id, job_id, shipping_load_id, checklist_type, checklist_date, status, inspector_name, approved_by, notes")
          .order("checklist_date", { ascending: false }),
        supabase
          .from("qc_checklist_items")
          .select("id, checklist_id, line_no, item_label, is_checked, note")
          .order("line_no", { ascending: true }),
        supabase
          .from("job_pm_details")
          .select("id, job_id, sold_to_name, sold_to_address, ship_to_name, ship_to_address, customer_po, internal_po, notes"),
        supabase
          .from("job_due_dates")
          .select("id, job_id, due_date, label, quantity, sort_order, is_completed, completed_at")
          .order("due_date", { ascending: true })
          .order("sort_order", { ascending: true }),
        supabase
          .from("import_batches")
          .select(
            "id, job_id, file_type, original_filename, imported_at, source_application, source_application_version, plugin_version, source_project_number, source_project_name, source_file_creation_date, status, error_text"
          )
          .order("imported_at", { ascending: false }),
        supabase
          .from("import_items")
          .select(
            "id, import_batch_id, job_id, drawing_number, drawing_title, drawing_category, drawing_revision, assembly_mark, sequence, phase, quantity, weight_lbs, dimensions, grade, finish, description"
          )
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("subcontractors")
          .select("id, name, logo_url, is_archived")
          .eq("is_archived", false)
          .order("name", { ascending: true }),
      ]);

      const optionalDueDateMissing = dueDatesRes.error && String(dueDatesRes.error.message || "").toLowerCase().includes("job_due_dates");
      const errors = [jobsRes.error, loadsRes.error, loadItemsRes.error, qcRes.error, qcItemsRes.error, pmDetailsRes.error, optionalDueDateMissing ? null : dueDatesRes.error, importsRes.error, importItemsRes.error, subsRes.error].filter(Boolean);
      if (errors.length) throw errors[0];

      const jobsData = (jobsRes.data || []) as JobRow[];
      const loadsData = (loadsRes.data || []) as ShippingLoad[];
      const loadItemsData = (loadItemsRes.data || []) as ShippingLoadItem[];
      const qcData = (qcRes.data || []) as QcChecklist[];
      const qcItemsData = (qcItemsRes.data || []) as QcChecklistItem[];
      const pmDetailsData = (pmDetailsRes.data || []) as JobPmDetail[];
      const dueDatesData = optionalDueDateMissing ? [] : ((dueDatesRes.data || []) as JobDueDate[]);
      const importsData = (importsRes.data || []) as ImportBatch[];
      const importItemsData = (importItemsRes.data || []) as ImportItem[];
      setSubcontractors((subsRes.data || []) as Subcontractor[]);

      const loadCountByJob: Record<string, number> = {};
      for (const load of loadsData) loadCountByJob[load.job_id] = (loadCountByJob[load.job_id] || 0) + 1;

      const openQcByJob: Record<string, number> = {};
      for (const qc of qcData) {
        if (["open", "failed"].includes((qc.status || "").toLowerCase())) {
          openQcByJob[qc.job_id] = (openQcByJob[qc.job_id] || 0) + 1;
        }
      }

      setJobs(
        jobsData.map((job) => ({
          ...job,
          load_count: loadCountByJob[job.id] || 0,
          open_qc_count: openQcByJob[job.id] || 0,
        }))
      );

      const loadMap: Record<string, ShippingLoad[]> = {};
      for (const load of loadsData) {
        if (!loadMap[load.job_id]) loadMap[load.job_id] = [];
        loadMap[load.job_id].push(load);
      }
      setLoadsByJob(loadMap);

      const loadItemMap: Record<string, ShippingLoadItem[]> = {};
      for (const item of loadItemsData) {
        if (!loadItemMap[item.shipping_load_id]) loadItemMap[item.shipping_load_id] = [];
        loadItemMap[item.shipping_load_id].push(item);
      }
      setLoadItemsByLoad(loadItemMap);

      const qcMap: Record<string, QcChecklist[]> = {};
      for (const checklist of qcData) {
        if (!qcMap[checklist.job_id]) qcMap[checklist.job_id] = [];
        qcMap[checklist.job_id].push(checklist);
      }
      setQcByJob(qcMap);

      const qcItemMap: Record<string, QcChecklistItem[]> = {};
      for (const item of qcItemsData) {
        if (!qcItemMap[item.checklist_id]) qcItemMap[item.checklist_id] = [];
        qcItemMap[item.checklist_id].push(item);
      }
      setQcItemsByChecklist(qcItemMap);

      const pmMap: Record<string, JobPmDetail> = {};
      for (const detail of pmDetailsData) pmMap[detail.job_id] = detail;
      setPmDetailsByJob(pmMap);

      const dueDateMap: Record<string, JobDueDate[]> = {};
      for (const due of dueDatesData) {
        if (!dueDateMap[due.job_id]) dueDateMap[due.job_id] = [];
        dueDateMap[due.job_id].push(due);
      }
      setDueDatesByJob(dueDateMap);

      const importMap: Record<string, ImportBatch[]> = {};
      for (const batch of importsData) {
        if (!batch.job_id) continue;
        if (!importMap[batch.job_id]) importMap[batch.job_id] = [];
        importMap[batch.job_id].push(batch);
      }
      setImportsByJob(importMap);

      const importItemMap: Record<string, ImportItem[]> = {};
      for (const item of importItemsData) {
        if (!importItemMap[item.import_batch_id]) importItemMap[item.import_batch_id] = [];
        importItemMap[item.import_batch_id].push(item);
      }
      setImportItemsByBatch(importItemMap);

      const firstJobId = selectedJobId && jobsData.some((job) => job.id === selectedJobId) ? selectedJobId : jobsData[0]?.id || null;
      setSelectedJobId(firstJobId);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load PM workspace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedJob) {
      setJobDraft(null);
      setSelectedImportBatchIds([]);
      return;
    }
    const detail = pmDetailsByJob[selectedJob.id];
    setJobDraft({
      pm_status: selectedJob.pm_status || "Not Started",
      fabrication_due_date: selectedJob.fabrication_due_date || "",
      percent_complete: String(selectedJob.percent_complete ?? 0),
      project_notes: selectedJob.project_notes || "",
      ship_to_name: detail?.ship_to_name || selectedJob.ship_to_name || "",
      ship_to_address: detail?.ship_to_address || selectedJob.ship_to_address || "",
      sold_to_name: detail?.sold_to_name || "",
      sold_to_address: detail?.sold_to_address || "",
      customer_po: detail?.customer_po || selectedJob.po_number || "",
      internal_po: detail?.internal_po || "",
      notes: detail?.notes || "",
    });
    setShippingForm({
      load_number: nextLoadNumber(loadsByJob[selectedJob.id] || []),
      ship_date: "",
      ship_to_name: detail?.ship_to_name || selectedJob.ship_to_name || "",
      ship_to_address: detail?.ship_to_address || selectedJob.ship_to_address || "",
      po_number: detail?.customer_po || selectedJob.po_number || "",
      shipping_signature_name: "",
      received_signature_name: "",
      ticket_notes: "",
    });
    const existingDueDates = dueDatesByJob[selectedJob.id] || [];
    setMultipleDueDates(existingDueDates.length > 1);
    setDueDateDrafts(
      existingDueDates.length
        ? existingDueDates.map((due, index) => ({ id: due.id, due_date: due.due_date || "", label: due.label || (index ? `Release ${index + 1}` : "Final due date"), quantity: due.quantity ? String(due.quantity) : "", is_completed: !!due.is_completed }))
        : [makeDueDateDraft(selectedJob.fabrication_due_date || "", 0)]
    );
    setShippingItems([]);
    setSelectedLoadId(null);
    const firstBatch = (importsByJob[selectedJob.id] || [])[0]?.id || null;
    setSelectedImportBatchIds(firstBatch ? [firstBatch] : []);
    setActivePcTab("Load Tracking");
  }, [selectedJob, pmDetailsByJob, importsByJob, loadsByJob, dueDatesByJob]);

  const statuses = useMemo(
    () => ["All", ...Array.from(new Set(jobs.map((job) => job.pm_status).filter(Boolean) as string[]))],
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter((job) => {
      if (statusFilter !== "All" && (job.pm_status || "") !== statusFilter) return false;
      if (!needle) return true;
      return [job.job_number, job.job_name, job.pm_status, job.po_number].some((value) =>
        (value || "").toLowerCase().includes(needle)
      );
    });
  }, [jobs, q, statusFilter]);

  const activeJobs = jobs.filter((job) => !job.is_archived && (job.pm_status || "") !== "Closed");
  const upcomingLoads = Object.values(loadsByJob)
    .flat()
    .filter((load) => {
      if (!load.ship_date) return false;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const shipTime = new Date(load.ship_date + "T00:00:00").getTime();
      return shipTime >= start.getTime() && shipTime <= end.getTime();
    });
  const openQc = Object.values(qcByJob)
    .flat()
    .filter((checklist) => ["open", "failed"].includes((checklist.status || "").toLowerCase()));
  const lateJobItems = activeJobs.flatMap((job) => {
    if (["Closed", "Shipped"].includes(job.pm_status || "")) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDates = dueDatesByJob[job.id] || [];
    if (dueDates.length) {
      return dueDates
        .filter((due) => !due.is_completed && due.due_date && new Date(due.due_date + "T00:00:00").getTime() < today.getTime())
        .map((due) => ({ job, due }));
    }
    if (!job.fabrication_due_date) return [];
    const due = new Date(job.fabrication_due_date + "T00:00:00").getTime();
    return due < today.getTime() ? [{ job, due: null as JobDueDate | null }] : [];
  });
  const lateJobs = Array.from(new Map(lateJobItems.map((item) => [item.job.id, item.job])).values());

  const subsById = useMemo(() => {
    const map: Record<string, Subcontractor> = {};
    for (const sub of subcontractors) map[sub.id] = sub;
    return map;
  }, [subcontractors]);

  const calendarDays = useMemo(() => monthDays(calendarMonth), [calendarMonth]);

  const calendarJobsByDate = useMemo(() => {
    const map: Record<string, { job: JobSummary; due?: JobDueDate }[]> = {};
    for (const job of activeJobs) {
      const dueDates = dueDatesByJob[job.id] || [];
      if (dueDates.length) {
        for (const due of dueDates) {
          if (!due.due_date) continue;
          const key = due.due_date.slice(0, 10);
          if (!map[key]) map[key] = [];
          map[key].push({ job, due });
        }
      } else {
        const date = job.fabrication_due_date || job.projected_finish_date;
        if (!date) continue;
        const key = date.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push({ job });
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.job.job_number || "").localeCompare(b.job.job_number || ""));
    }
    return map;
  }, [activeJobs, dueDatesByJob]);

  async function saveJobWorkspace() {
    if (!selectedJob || !jobDraft) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const jobUpdate = {
        pm_status: jobDraft.pm_status,
        fabrication_due_date: jobDraft.fabrication_due_date || null,
        percent_complete: Number(jobDraft.percent_complete || 0),
        project_notes: jobDraft.project_notes || null,
        ship_to_name: jobDraft.ship_to_name || null,
        ship_to_address: jobDraft.ship_to_address || null,
      };

      const { error: updateJobError } = await supabase.from("jobs").update(jobUpdate).eq("id", selectedJob.id);
      if (updateJobError) throw updateJobError;

      const existingDetail = pmDetailsByJob[selectedJob.id];
      const detailPayload = {
        job_id: selectedJob.id,
        sold_to_name: jobDraft.sold_to_name || null,
        sold_to_address: jobDraft.sold_to_address || null,
        ship_to_name: jobDraft.ship_to_name || null,
        ship_to_address: jobDraft.ship_to_address || null,
        customer_po: jobDraft.customer_po || null,
        internal_po: jobDraft.internal_po || null,
        notes: jobDraft.notes || null,
      };

      if (existingDetail) {
        const { error: detailErr } = await supabase.from("job_pm_details").update(detailPayload).eq("id", existingDetail.id);
        if (detailErr) throw detailErr;
      } else {
        const { error: insertErr } = await supabase.from("job_pm_details").insert(detailPayload);
        if (insertErr) throw insertErr;
      }

      const cleanDueDates = (multipleDueDates ? dueDateDrafts : [makeDueDateDraft(jobDraft.fabrication_due_date, 0)])
        .map((due, index) => ({ ...due, sort_order: index }))
        .filter((due) => due.due_date);

      const { error: deleteDueErr } = await supabase.from("job_due_dates").delete().eq("job_id", selectedJob.id);
      if (deleteDueErr) throw deleteDueErr;

      if (cleanDueDates.length) {
        const { error: dueErr } = await supabase.from("job_due_dates").insert(
          cleanDueDates.map((due) => ({
            job_id: selectedJob.id,
            due_date: due.due_date,
            label: due.label || null,
            quantity: due.quantity ? Number(due.quantity) : null,
            sort_order: due.sort_order,
            is_completed: !!due.is_completed,
            completed_at: due.is_completed ? new Date().toISOString() : null,
          }))
        );
        if (dueErr) throw dueErr;
      }

      setSuccess("Job workspace saved.");
      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save job workspace.");
    } finally {
      setSaving(false);
    }
  }

  async function createChecklist(checklistType: QcChecklist["checklist_type"]) {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: qcErr } = await supabase
        .from("qc_checklists")
        .insert({
          job_id: selectedJob.id,
          checklist_type: checklistType,
          checklist_date: new Date().toISOString().slice(0, 10),
          status: "Open",
        })
        .select("id")
        .single();
      if (qcErr) throw qcErr;

      const { error: seedErr } = await supabase.rpc("seed_qc_checklist_items", { p_checklist_id: data.id });
      if (seedErr) throw seedErr;

      setSuccess(`${checklistType} created.`);
      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to create checklist.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklistItem(item: QcChecklistItem) {
    setError(null);
    try {
      const { error: itemErr } = await supabase
        .from("qc_checklist_items")
        .update({ is_checked: !item.is_checked })
        .eq("id", item.id);
      if (itemErr) throw itemErr;
      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to update checklist item.");
    }
  }

  async function saveShippingLoad() {
    if (!selectedJob) return;
    if (!shippingForm.load_number.trim()) {
      setError("Load number is required.");
      return;
    }

    const editingLoadId = shippingForm.id || selectedLoadId || null;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const validItems = shippingItems.filter((item) => item.mark.trim());
      const duplicateMarks = Array.from(new Set(validItems.map((item) => normalizeMark(item.mark)).filter(Boolean).filter((mark, index, arr) => arr.indexOf(mark) !== index)));
      if (duplicateMarks.length) {
        setError(`Duplicate marks found on the ticket: ${duplicateMarks.join(", ")}. Keep each mark on one line && adjust the quantity on that line.`);
        setSaving(false);
        return;
      }
      const assemblyQuantity = validItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalWeight = validItems.reduce((sum, item) => sum + Number(item.weight_lbs || 0), 0);

      const payload = {
        job_id: selectedJob.id,
        load_number: shippingForm.load_number.trim(),
        ship_date: shippingForm.ship_date || null,
        ship_to_name: shippingForm.ship_to_name || null,
        ship_to_address: shippingForm.ship_to_address || null,
        po_number: shippingForm.po_number || null,
        shipping_signature_name: shippingForm.shipping_signature_name || null,
        received_signature_name: shippingForm.received_signature_name || null,
        ticket_notes: shippingForm.ticket_notes || null,
        assembly_quantity: assemblyQuantity || null,
        weight_loaded_lbs: totalWeight || null,
      };

      let loadId = editingLoadId;

      if (editingLoadId) {
        const { error: loadErr } = await supabase
          .from("shipping_loads")
          .update(payload)
          .eq("id", editingLoadId)
          .eq("job_id", selectedJob.id);
        if (loadErr) throw loadErr;

        const { error: deleteErr } = await supabase
          .from("shipping_load_items")
          .delete()
          .eq("shipping_load_id", editingLoadId);
        if (deleteErr) throw deleteErr;
      } else {
        const { data: loadData, error: loadErr } = await supabase
          .from("shipping_loads")
          .insert(payload)
          .select("id")
          .single();
        if (loadErr) throw loadErr;
        loadId = loadData.id;
      }

      const lineItems = validItems.map((item, index) => ({
        shipping_load_id: loadId,
        job_id: selectedJob.id,
        line_no: index + 1,
        mark: item.mark.trim(),
        quantity: Number(item.quantity || 0),
        weight_lbs: Number(item.weight_lbs || 0),
        description: item.description.trim() || null,
        sequence: item.sequence.trim() || null,
        finish: item.finish.trim() || null,
      }));

      if (lineItems.length > 0) {
        const { error: itemErr } = await supabase.from("shipping_load_items").insert(lineItems);
        if (itemErr) throw itemErr;
      }

      setSuccess(editingLoadId ? "Shipping load updated." : "Shipping load saved.");
      await loadAll();
      setSelectedLoadId(null);
      setShippingForm((prev) => ({
        ...prev,
        id: undefined,
        load_number: editingLoadId ? prev.load_number : nextLoadNumber([...(loadsByJob[selectedJob.id] || []), { id: "", job_id: selectedJob.id, load_number: shippingForm.load_number.trim(), ship_date: null, ship_to_name: null, ship_to_address: null, po_number: null, assembly_quantity: null, weight_loaded_lbs: null, ticket_notes: null, shipping_signature_name: null, received_signature_name: null }]),
        ship_date: "",
        shipping_signature_name: "",
        received_signature_name: "",
        ticket_notes: "",
      }));
      setShippingItems([]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save shipping load.");
    } finally {
      setSaving(false);
    }
  }

  function openPrintWindow(html: string) {
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) {
      setError("Popup blocked. Allow popups to print shipping tickets.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 250);
  }

  function printShippingTicket() {
    if (!selectedJob) return;
    const html = buildPrintHtml({
      job: selectedJob,
      pmDetail: selectedJobPmDetail,
      shippingForm,
      items: shippingItems,
    });
    openPrintWindow(html);
  }

  function printSavedShippingTicket(load: ShippingLoad) {
    if (!selectedJob) return;
    const savedItems = (loadItemsByLoad[load.id] || []).map((item) => ({
      id: item.id,
      mark: item.mark || "",
      quantity: String(item.quantity ?? ""),
      weight_lbs: String(item.weight_lbs ?? ""),
      description: item.description || "",
      sequence: item.sequence || "",
      finish: item.finish || "",
      unit_weight_lbs: Number(item.quantity || 0) > 0 && Number(item.weight_lbs || 0) > 0 ? Number(item.weight_lbs || 0) / Number(item.quantity || 0) : null,
    }));

    const savedForm: ShippingForm = {
      id: load.id,
      load_number: load.load_number || "",
      ship_date: load.ship_date || "",
      ship_to_name: load.ship_to_name || selectedJob.ship_to_name || selectedJobPmDetail?.ship_to_name || "",
      ship_to_address: load.ship_to_address || selectedJob.ship_to_address || selectedJobPmDetail?.ship_to_address || "",
      po_number: load.po_number || selectedJob.po_number || selectedJobPmDetail?.customer_po || "",
      shipping_signature_name: load.shipping_signature_name || "",
      received_signature_name: load.received_signature_name || "",
      ticket_notes: load.ticket_notes || "",
    };

    const html = buildPrintHtml({
      job: selectedJob,
      pmDetail: selectedJobPmDetail,
      shippingForm: savedForm,
      items: savedItems,
    });
    openPrintWindow(html);
  }

  async function deleteShippingLoad(load: ShippingLoad) {
    if (!selectedJob) return;
    const okay = window.confirm(`Delete Load ${load.load_number}? This will remove the saved load and its line items.`);
    if (!okay) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: itemsErr } = await supabase.from("shipping_load_items").delete().eq("shipping_load_id", load.id);
      if (itemsErr) throw itemsErr;
      const { error: loadErr } = await supabase.from("shipping_loads").delete().eq("id", load.id).eq("job_id", selectedJob.id);
      if (loadErr) throw loadErr;
      if (selectedLoadId === load.id || shippingForm.id === load.id) {
        setSelectedLoadId(null);
        setShippingForm((prev) => ({
          ...prev,
          id: undefined,
          load_number: nextLoadNumber((loadsByJob[selectedJob.id] || []).filter((row) => row.id !== load.id)),
          ship_date: "",
          shipping_signature_name: "",
          received_signature_name: "",
          ticket_notes: "",
        }));
        setShippingItems([]);
      }
      setSuccess(`Load ${load.load_number} deleted.`);
      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to delete shipping load.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImportFile(file: File, fileType: "xml" | "kss") {
    if (!selectedJob) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const text = await file.text();
      const parsed = fileType === "xml" ? parseXml(text) : parseKss(text);
      const { data: batch, error: batchErr } = await supabase
        .from("import_batches")
        .insert({
          job_id: selectedJob.id,
          file_type: fileType,
          original_filename: file.name,
          source_application: parsed.header.sourceApplication || null,
          source_application_version: parsed.header.sourceApplicationVersion || null,
          plugin_version: parsed.header.pluginVersion || null,
          source_project_number: parsed.header.projectNumber || null,
          source_project_name: parsed.header.projectName || null,
          source_file_creation_date: parsed.header.fileCreationDate || null,
          status: "Applied",
        })
        .select("id")
        .single();
      if (batchErr) throw batchErr;

      const importItems = parsed.items.slice(0, 2000).map((item) => ({
        import_batch_id: batch.id,
        job_id: selectedJob.id,
        drawing_number: item.drawing_number,
        drawing_title: item.drawing_title,
        drawing_category: item.drawing_category,
        drawing_revision: item.drawing_revision,
        assembly_mark: item.assembly_mark,
        sequence: item.sequence,
        phase: item.phase,
        quantity: item.quantity,
        weight_lbs: item.weight_lbs,
        dimensions: item.dimensions,
        grade: item.grade,
        finish: item.finish,
        description: item.description,
      }));

      if (importItems.length > 0) {
        const { error: itemErr } = await supabase.from("import_items").insert(importItems);
        if (itemErr) throw itemErr;
      }

      setSuccess(`${file.name} imported. ${importItems.length} item${importItems.length === 1 ? "" : "s"} parsed for this job.`);
      await loadAll();
      setSelectedImportBatchIds([batch.id]);
      setActivePcTab("Load Tracking");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || `Failed to import ${file.name}.`);
    } finally {
      setSaving(false);
      if (xmlInputRef.current) xmlInputRef.current.value = "";
      if (kssInputRef.current) kssInputRef.current.value = "";
    }
  }

  async function renameImportBatch(batch: ImportBatch) {
    const nextName = window.prompt("Rename this import file", batch.original_filename || "");
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === batch.original_filename) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.from("import_batches").update({ original_filename: trimmed }).eq("id", batch.id);
      if (error) throw error;
      setSuccess("Import renamed.");
      await loadAll();
      setSelectedImportBatchIds([batch.id]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to rename import.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteImportBatch(batch: ImportBatch) {
    const okay = window.confirm(`Delete ${batch.original_filename}? This will remove the parsed rows for this import.`);
    if (!okay) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: itemsErr } = await supabase.from("import_items").delete().eq("import_batch_id", batch.id);
      if (itemsErr) throw itemsErr;
      const { error: batchErr } = await supabase.from("import_batches").delete().eq("id", batch.id);
      if (batchErr) throw batchErr;
      setSuccess("Import deleted.");
      setSelectedImportBatchIds((prev) => prev.filter((id) => id !== batch.id));
      await loadAll();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to delete import.");
    } finally {
      setSaving(false);
    }
  }

  function addImportItemToShipping(item: ImportItem) {
    const mark = item.assembly_mark || item.drawing_number || "";
    const markKey = normalizeMark(mark);
    if (!markKey) {
      setError("That import row has no mark to add.");
      return;
    }
    let added = false;
    setError(null);
    setSuccess(null);
    setShippingItems((rows) => {
      const existingIndex = rows.findIndex((row) => normalizeMark(row.mark) === markKey);
      if (existingIndex >= 0) return rows;
      const nextRow = makeShippingDraftFromImportItem(item);
      if (!nextRow) return rows;
      added = true;
      return mergeShippingRows(rows, [nextRow]);
    });
    setSuccess(added ? `${mark} added to the shipping ticket draft.` : `${mark} is already on the shipping ticket draft.`);
  }

  function makeShippingDraftFromImportItem(item: ImportItem): ShippingItemDraft | null {
    const mark = item.assembly_mark || item.drawing_number || "";
    if (!normalizeMark(mark)) return null;
    const qty = Math.max(Number(item.quantity || 1), 1);
    const weight = Number(item.weight_lbs || 0);
    const unitWeight = qty > 0 && Number.isFinite(weight) && weight > 0 ? weight / qty : null;
    return {
      id: crypto.randomUUID(),
      mark,
      quantity: String(qty),
      weight_lbs: weight ? cleanNumberString(weight) : "",
      description: item.description || item.drawing_title || "",
      sequence: item.sequence || "",
      finish: item.finish || "",
      unit_weight_lbs: unitWeight,
    };
  }

  function mergeShippingRows(existingRows: ShippingItemDraft[], incomingRows: ShippingItemDraft[]) {
    const rows = existingRows.length === 1 && isBlankShippingDraft(existingRows[0]) ? [] : [...existingRows];

    for (const incoming of incomingRows) {
      const key = normalizeMark(incoming.mark);
      if (!key) continue;

      const existingIndex = rows.findIndex((row) => normalizeMark(row.mark) === key);
      if (existingIndex < 0) {
        rows.push(incoming);
        continue;
      }

      const existing = rows[existingIndex];
      const existingQty = Number(existing.quantity || 0);
      const incomingQty = Number(incoming.quantity || 0);
      const existingWeight = Number(existing.weight_lbs || 0);
      const incomingWeight = Number(incoming.weight_lbs || 0);
      const nextQty = existingQty + incomingQty;
      const nextWeight = existingWeight + incomingWeight;

      rows[existingIndex] = {
        ...existing,
        quantity: nextQty ? cleanNumberString(nextQty) : existing.quantity,
        weight_lbs: nextWeight ? cleanNumberString(nextWeight) : existing.weight_lbs,
        description: existing.description || incoming.description,
        sequence: existing.sequence || incoming.sequence,
        finish: existing.finish || incoming.finish,
        unit_weight_lbs: nextQty > 0 && nextWeight > 0 ? nextWeight / nextQty : existing.unit_weight_lbs || incoming.unit_weight_lbs || null,
      };
    }

    return rows;
  }

  function buildShippingRowsFromImportBatches(batchIds: string[]) {
    let nextRows: ShippingItemDraft[] = [];

    for (const batchId of batchIds) {
      const batchItems = importItemsByBatch[batchId] || [];
      const mainItems = batchItems.filter((item) => (item.drawing_category || "").toUpperCase() === "MAIN");
      const items = (mainItems.length ? mainItems : batchItems).slice(0, 250);
      const batchRows = items
        .map((item) => makeShippingDraftFromImportItem(item))
        .filter((row): row is ShippingItemDraft => !!row);

      nextRows = mergeShippingRows(nextRows, batchRows).filter((row) => !isBlankShippingDraft(row));
    }

    return nextRows;
  }

  function copyImportItemsToShipping(batchId: string) {
    const nextRows = buildShippingRowsFromImportBatches([batchId]);
    if (nextRows.length === 0) {
      setError("That import has no parsed rows to copy.");
      return;
    }
    setShippingItems((prev) => mergeShippingRows(prev, nextRows));
    setSuccess("Imported items added into the shipping ticket draft. Matching marks are combined and weights stay tied to quantity.");
  }

  function copySelectedImportsToShipping() {
    const batchIds = selectedImportBatchIds.length ? selectedImportBatchIds : selectedJobImports.map((batch) => batch.id);
    const nextRows = buildShippingRowsFromImportBatches(batchIds);
    if (nextRows.length === 0) {
      setError("No selected imports have parsed rows to copy.");
      return;
    }
    setShippingItems((prev) => mergeShippingRows(prev, nextRows));
    setSuccess(`${batchIds.length} import${batchIds.length === 1 ? "" : "s"} added into the shipping ticket draft. Matching marks are combined and weights stay tied to quantity.`);
  }

  function clearShippingTicketLines() {
    const okay = window.confirm("Remove all lines from the shipping ticket draft?");
    if (!okay) return;
    setShippingItems([]);
    setSuccess("Shipping ticket lines cleared.");
  }

  function multiplyShippingQuantities() {
    const multiplier = Number(quantityMultiplier);
    if (!Number.isInteger(multiplier) || multiplier < 1) {
      setError("Enter a whole-number multiplier: 1, 2, 3, 4, etc.");
      return;
    }

    const okay = window.confirm(`Multiply every shipping ticket quantity by ${multiplier}?`);
    if (!okay) return;

    setError(null);
    setSuccess(null);
    setShippingItems((prev) =>
      prev.map((row) => {
        if (isBlankShippingDraft(row)) return row;
        const currentQty = Number(row.quantity || 0);
        if (!Number.isFinite(currentQty)) return row;
        const nextQty = currentQty * multiplier;
        return updateShippingQuantity(row, cleanNumberString(nextQty));
      })
    );
    setSuccess(`Shipping ticket quantities multiplied by ${multiplier}. Weights updated from each line unit weight.`);
  }

  const openQcDetails = openQc.map((qc) => ({
    ...qc,
    job: jobs.find((job) => job.id === qc.job_id),
    itemCount: (qcItemsByChecklist[qc.id] || []).filter((item) => !item.is_checked).length,
  }));

  const selectedBatch = selectedImportBatchIds.length
    ? selectedJobImports.find((batch) => batch.id === selectedImportBatchIds[0]) || null
    : selectedJobImports[0] || null;

  function toggleImportBatch(batchId: string) {
    setSelectedImportBatchIds((prev) =>
      prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]
    );
  }
  const selectedBatchItems = selectedBatch ? importItemsByBatch[selectedBatch.id] || [] : [];
  const selectedMainBatchItems = useMemo(
    () => selectedBatchItems.filter((item) => (item.drawing_category || "").toUpperCase() === "MAIN"),
    [selectedBatchItems]
  );
  const selectedShippingImportItems = useMemo(
    () => selectedMainBatchItems.length ? selectedMainBatchItems : selectedBatchItems,
    [selectedMainBatchItems, selectedBatchItems]
  );

  const importStats = useMemo(() => {
    const mainRows = selectedBatchItems.filter((item) => (item.drawing_category || "").toUpperCase() === "MAIN");
    const partRows = selectedBatchItems.filter((item) => (item.drawing_category || "").toUpperCase() === "PART");
    return {
      mains: mainRows.length,
      parts: partRows.length,
      qty: selectedBatchItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      weight: selectedBatchItems.reduce((sum, item) => sum + Number(item.weight_lbs || 0), 0),
    };
  }, [selectedBatchItems]);

  const filteredImportItems = useMemo(() => {
    const needle = importSearch.trim().toLowerCase();
    return selectedShippingImportItems.filter((item) => {
      if (!needle) return true;
      return [
        item.assembly_mark,
        item.description,
        item.dimensions,
        item.grade,
        item.sequence,
        item.drawing_number,
        item.drawing_category,
      ].some((value) => (value || "").toLowerCase().includes(needle));
    });
  }, [selectedShippingImportItems, importSearch]);

  const sequenceOptions = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(selectedShippingImportItems.map((item) => item.sequence).filter(Boolean) as string[])).sort(),
    ];
  }, [selectedShippingImportItems]);

  const loadTrackingRows = useMemo(() => {
    return selectedShippingImportItems.filter((item) => {
      if (loadSequenceFilter !== "All" && (item.sequence || "") !== loadSequenceFilter) return false;
      const needle = loadSearch.trim().toLowerCase();
      if (!needle) return true;
      return [item.assembly_mark, item.description, item.dimensions, item.sequence, item.phase].some((value) =>
        (value || "").toLowerCase().includes(needle)
      );
    });
  }, [selectedShippingImportItems, loadSequenceFilter, loadSearch]);

  const selectedLoad = selectedLoadId ? selectedJobLoads.find((load) => load.id === selectedLoadId) || null : null;
  const selectedLoadItems = selectedLoad ? loadItemsByLoad[selectedLoad.id] || [] : [];
  const shippingDraftMarkKeys = useMemo(
    () => new Set(shippingItems.map((item) => normalizeMark(item.mark)).filter(Boolean)),
    [shippingItems]
  );

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/stakd-logo.png" alt="STAKD logo" width={36} height={36} className="h-9 w-9" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">PM Workspace</h1>
              <p className="text-sm text-slate-500">Focused job status, dates, PO info, QC issues, and shipping loads.</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowOpenQc(true)} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">View Open QC</button>
        </div>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active PM Jobs</div><div className="mt-2 text-3xl font-semibold text-slate-950">{fmtNum(activeJobs.length)}</div><div className="mt-1 text-xs text-slate-500">Open work, archived removed</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping This Week</div><div className="mt-2 text-3xl font-semibold text-slate-950">{fmtNum(upcomingLoads.length)}</div><div className="mt-1 text-xs text-slate-500">Loads due in next 7 days</div></div>
          <button type="button" onClick={() => setShowOpenQc(true)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-sky-300"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open QC</div><div className="mt-2 text-3xl font-semibold text-slate-950">{fmtNum(openQc.length)}</div><div className="mt-1 text-xs text-slate-500">Click for details</div></button>
          <button type="button" onClick={() => setShowLateJobs(true)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-red-300"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Late Jobs</div><div className="mt-2 text-3xl font-semibold text-slate-950">{fmtNum(lateJobs.length)}</div><div className="mt-1 text-xs text-slate-500">Past fabrication due date</div></button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Master PM Calendar</h2>
              <p className="text-sm text-slate-500">Monthly view by fabrication due date. Subcontractor logos/names show on assigned jobs.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCalendarMonth((m) => shiftMonth(m, -1))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Prev</button>
              <div className="min-w-44 text-center text-sm font-semibold text-slate-900">{monthLabel(calendarMonth)}</div>
              <button type="button" onClick={() => setCalendarMonth((m) => shiftMonth(m, 1))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Next</button>
            </div>
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 text-sm">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</div>
            ))}
            {calendarDays.map((day) => {
              const key = isoDate(day);
              const dayJobs = calendarJobsByDate[key] || [];
              const inMonth = key.startsWith(calendarMonth);
              return (
                <div key={key} className={(inMonth ? "bg-white" : "bg-slate-50 text-slate-400") + " min-h-36 border-b border-r border-slate-200 p-2"}>
                  <div className="mb-2 text-xs font-semibold text-slate-500">{day.getDate()}</div>
                  <div className="space-y-1.5">
                    {dayJobs.slice(0, 4).map(({ job, due }) => {
                      const sub = job.outsourced_to ? subsById[job.outsourced_to] : null;
                      const jobComplete = Number(job.percent_complete ?? 0) >= 100 || ["closed", "shipped"].includes((job.pm_status || "").toLowerCase());
                      const health = due?.is_completed || jobComplete
                        ? { label: "Done", cls: "border-emerald-300 bg-emerald-50 text-emerald-800 line-through" }
                        : dueHealth({ ...job, fabrication_due_date: due?.due_date || job.fabrication_due_date });
                      return (
                        <button key={`${job.id}-${due?.id || "main"}`} type="button" onClick={() => setSelectedJobId(job.id)} className={"w-full rounded-xl border px-2 py-1.5 text-left text-xs shadow-sm " + health.cls}>
                          <div className="flex items-center gap-1.5">
                            {sub?.logo_url ? <img src={sub.logo_url} alt="" className="h-5 w-5 rounded bg-white object-contain" /> : null}
                            <span className="font-semibold">{job.job_number || "—"}</span>
                          </div>
                          <div className="truncate">{job.job_name || "Untitled"}</div>
                          <div className="truncate opacity-80">{due?.label ? `${due.label} • ` : ""}{sub?.name || "In house"} • {health.label}</div>
                        </button>
                      );
                    })}
                    {dayJobs.length > 4 ? <div className="text-xs font-semibold text-slate-500">+{dayJobs.length - 4} more</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Jobs</h2><p className="text-sm text-slate-500">Pick a job to manage.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{fmtNum(filteredJobs.length)} shown</span></div>
              <div className="grid gap-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job, PO, status..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
            </div>
            <div className="max-h-[calc(100vh-360px)] min-h-[520px] overflow-auto p-3">
              {loading ? <div className="p-6 text-sm text-slate-500">Loading PM workspace...</div> : filteredJobs.length === 0 ? <div className="p-6 text-sm text-slate-500">No PM jobs found.</div> : <div className="space-y-2">{filteredJobs.map((job) => {
                  const health = dueHealth(job);
                  const isSelected = selectedJobId === job.id;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => setSelectedJobId(job.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition shadow-sm ${isSelected ? "border-sky-500 ring-2 ring-sky-100" : "hover:border-slate-300 hover:shadow-md"} ${health.cls}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">{job.job_number || "-"}</div>
                          <div className="truncate text-sm text-slate-700">{job.job_name || "Untitled job"}</div>
                          <div className="mt-1 text-xs text-slate-600">PO: {job.po_number || "-"}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(job.pm_status)}`}>{job.pm_status || "-"}</span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${health.cls}`}>{health.label}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-700">
                        <div><span className="font-medium text-slate-800">Due</span><br />{fmtDate(job.fabrication_due_date)}{(dueDatesByJob[job.id] || []).length > 1 ? ` +${(dueDatesByJob[job.id] || []).length - 1}` : ""}</div>
                        <div><span className="font-medium text-slate-800">Time</span><br /><span className={`font-semibold ${health.cls.includes("red") ? "text-red-700" : health.cls.includes("amber") ? "text-amber-700" : health.cls.includes("emerald") ? "text-emerald-700" : "text-slate-700"}`}>{health.label}</span></div>
                        <div><span className="font-medium text-slate-800">Done</span><br />{fmtNum(job.percent_complete)}%</div>
                        <div><span className="font-medium text-slate-800">QC</span><br />{fmtNum(job.open_qc_count)} open</div>
                      </div>
                    </button>
                  );
                })}</div>}
            </div>
          </section>

          <section className="space-y-5">
            {!selectedJob || !jobDraft ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500 shadow-sm">Pick a job on the left to open the PM controls.</div> : <>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-sm font-semibold uppercase tracking-wide text-sky-700">Selected Job</div><h2 className="mt-1 text-3xl font-semibold text-slate-950">{selectedJob.job_number || "—"} — {selectedJob.job_name || "Untitled job"}</h2><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone(jobDraft.pm_status)}`}>{jobDraft.pm_status}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{jobDraft.percent_complete || 0}% complete</span><span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">PO {jobDraft.customer_po || "—"}</span></div></div><button type="button" onClick={saveJobWorkspace} disabled={saving} className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : "Save PM Updates"}</button></div>
                <div className="mt-6 grid gap-4 lg:grid-cols-4"><label className="text-sm"><div className="mb-1 font-medium text-slate-700">PM Status</div><select value={jobDraft.pm_status} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, pm_status: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500">{PM_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Fab Due Date</div><input type="date" value={jobDraft.fabrication_due_date} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, fabrication_due_date: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">% Complete</div><input type="number" min="0" max="100" value={jobDraft.percent_complete} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, percent_complete: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Customer PO</div><input value={jobDraft.customer_po} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, customer_po: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label></div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Ship To Name</div><input value={jobDraft.ship_to_name} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, ship_to_name: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Ship To Address</div><input value={jobDraft.ship_to_address} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, ship_to_address: e.target.value } : prev))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label></div>
                <label className="mt-4 block text-sm"><div className="mb-1 font-medium text-slate-700">PM Notes / Next Step</div><textarea value={jobDraft.project_notes} onChange={(e) => setJobDraft((prev) => (prev ? { ...prev, project_notes: e.target.value } : prev))} rows={4} placeholder="What does the PM need to know next?" className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Multiple due dates</div>
                      <p className="mt-1 text-xs text-slate-500">Use this when a job releases in batches. Each date will show separately on the PM calendar.</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={multipleDueDates} onChange={(e) => {
                        const checked = e.target.checked;
                        setMultipleDueDates(checked);
                        setDueDateDrafts((prev) => checked ? (prev.length ? prev : [makeDueDateDraft(jobDraft.fabrication_due_date, 0)]) : [makeDueDateDraft(jobDraft.fabrication_due_date, 0)]);
                      }} className="h-4 w-4 rounded border-slate-300" />
                      This job has multiple due dates
                    </label>
                  </div>

                  {multipleDueDates ? (
                    <div className="mt-4 space-y-2">
                      {dueDateDrafts.map((due, index) => (
                        <div key={due.id || index} className={`grid gap-2 rounded-2xl border p-2 lg:grid-cols-[auto_1fr_160px_120px_auto] ${due.is_completed ? "border-emerald-200 bg-emerald-50" : "border-transparent"}`}>
                          <label className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                            <input type="checkbox" checked={due.is_completed} onChange={(e) => setDueDateDrafts((prev) => prev.map((row, i) => i === index ? { ...row, is_completed: e.target.checked } : row))} className="h-4 w-4 rounded border-slate-300" />
                            Done
                          </label>
                          <input value={due.label} onChange={(e) => setDueDateDrafts((prev) => prev.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} placeholder={`Release ${index + 1}`} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500" />
                          <input type="date" value={due.due_date} onChange={(e) => setDueDateDrafts((prev) => prev.map((row, i) => i === index ? { ...row, due_date: e.target.value } : row))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500" />
                          <input type="number" min="0" value={due.quantity} onChange={(e) => setDueDateDrafts((prev) => prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} placeholder="Qty" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500" />
                          <button type="button" onClick={() => setDueDateDrafts((prev) => prev.length === 1 ? [makeDueDateDraft(jobDraft.fabrication_due_date, 0)] : prev.filter((_, i) => i !== index))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setDueDateDrafts((prev) => [...prev, makeDueDateDraft("", prev.length)])} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50">+ Add due date</button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <div className={`rounded-3xl border p-5 shadow-sm ${dueHealth({ ...selectedJob, fabrication_due_date: jobDraft.fabrication_due_date }).cls}`}>
                  <div className="text-sm font-semibold uppercase tracking-wide opacity-80">Job Health</div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="opacity-80">Fab due</span><span className="font-semibold">{fmtDate(jobDraft.fabrication_due_date)}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Dashboard date</span><span className="font-semibold">{fmtDate(selectedJob.projected_finish_date)}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Schedule</span><span className="font-semibold">{dueHealth({ ...selectedJob, fabrication_due_date: jobDraft.fabrication_due_date }).label}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Due dates</span><span className="font-semibold">{multipleDueDates ? fmtNum(dueDateDrafts.filter((due) => due.due_date).length) : fmtNum(selectedJobDueDates.length || 1)}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Completed dates</span><span className="font-semibold">{multipleDueDates ? fmtNum(dueDateDrafts.filter((due) => due.due_date && due.is_completed).length) : fmtNum(selectedJobDueDates.filter((due) => due.is_completed).length)}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Shipping loads</span><span className="font-semibold">{fmtNum(selectedJobLoads.length)}</span></div>
                    <div className="flex items-center justify-between"><span className="opacity-80">Open QC</span><span className="font-semibold">{fmtNum(selectedJob.open_qc_count)}</span></div>
                  </div>
                </div>
              </div>

              <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" open>
                <summary className="cursor-pointer text-lg font-semibold text-slate-950">Shipping Loads</summary>
                <div className="mt-5 space-y-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950">Shipping Ticket Generator</h3>
                    <p className="mt-1 text-sm text-slate-500">Create and print a shipping ticket for the selected job. Save it when the load is final.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setShippingItems((prev) => [...prev, makeLineDraft()])} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Add Line</button>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-2 py-1">
                      <span className="text-xs font-semibold text-slate-600">Multiply qty by</span>
                      <input type="number" min="1" step="1" value={quantityMultiplier} onChange={(e) => setQuantityMultiplier(e.target.value.replace(/\D/g, ""))} className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500" />
                      <button type="button" onClick={multiplyShippingQuantities} className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900">Apply</button>
                    </div>
                    <button type="button" onClick={clearShippingTicketLines} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Clear Lines</button>
                    <button type="button" onClick={printShippingTicket} className="rounded-xl border border-sky-700 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50">Print Ticket</button>
                    <button type="button" onClick={saveShippingLoad} disabled={saving} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving..." : shippingForm.id ? "Update Load" : "Save Load"}</button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-4">
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Load Number</div><input value={shippingForm.load_number} onChange={(e) => setShippingForm((prev) => ({ ...prev, load_number: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Ship Date</div><input type="date" value={shippingForm.ship_date} onChange={(e) => setShippingForm((prev) => ({ ...prev, ship_date: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">PO</div><input value={shippingForm.po_number} onChange={(e) => setShippingForm((prev) => ({ ...prev, po_number: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Ship To Name</div><input value={shippingForm.ship_to_name} onChange={(e) => setShippingForm((prev) => ({ ...prev, ship_to_name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm lg:col-span-2"><div className="mb-1 font-medium text-slate-700">Ship To Address</div><input value={shippingForm.ship_to_address} onChange={(e) => setShippingForm((prev) => ({ ...prev, ship_to_address: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Shipping Signature</div><input value={shippingForm.shipping_signature_name} onChange={(e) => setShippingForm((prev) => ({ ...prev, shipping_signature_name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Receiving Signature</div><input value={shippingForm.received_signature_name} onChange={(e) => setShippingForm((prev) => ({ ...prev, received_signature_name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr><th className="px-3 py-3">Mark</th><th className="px-3 py-3">Qty</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">Sequence</th><th className="px-3 py-3">Finish</th><th className="px-3 py-3">Description</th><th className="px-3 py-3"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {shippingItems.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2"><input value={item.mark} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? { ...row, mark: e.target.value } : row))} className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2"><input type="number" value={item.quantity} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? updateShippingQuantity(row, e.target.value) : row))} className="w-24 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2"><input type="number" value={item.weight_lbs} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? { ...row, weight_lbs: e.target.value, unit_weight_lbs: Number(row.quantity || 0) > 0 && Number(e.target.value || 0) > 0 ? Number(e.target.value || 0) / Number(row.quantity || 0) : null } : row))} className="w-28 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2"><input value={item.sequence} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? { ...row, sequence: e.target.value } : row))} className="w-32 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2"><input value={item.finish} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? { ...row, finish: e.target.value } : row))} className="w-32 rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2"><input value={item.description} onChange={(e) => setShippingItems((prev) => prev.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} className="w-full rounded-lg border border-slate-300 px-2 py-1 outline-none focus:border-sky-500" /></td>
                          <td className="px-3 py-2 text-right"><button type="button" onClick={() => setShippingItems((prev) => prev.filter((_, i) => i !== index))} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-end rounded-xl border bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
                  Total Weight: {shippingItems.reduce((sum, item) => sum + Number(item.weight_lbs || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} lbs
                </div>

                <label className="mt-4 block text-sm"><div className="mb-1 font-medium text-slate-700">Ticket Notes</div><textarea value={shippingForm.ticket_notes} onChange={(e) => setShippingForm((prev) => ({ ...prev, ticket_notes: e.target.value }))} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-sky-500" /></label>
                  </div>
                  <div className="space-y-3">
                  {selectedJobLoads.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No saved loads for this job.</div> : null}
                  {selectedJobLoads.map((load) => {
                    const loadItems = loadItemsByLoad[load.id] || [];
                    return (
                      <div key={load.id} className={`rounded-2xl border p-4 ${selectedLoadId === load.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"}`}>
                        <button type="button" onClick={() => setSelectedLoadId(load.id)} className="w-full text-left">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="font-semibold text-slate-950">Load {load.load_number}</div>
                              <div className="mt-1 text-sm text-slate-500">Ship date: {fmtDate(load.ship_date)} • Weight: {fmtNum(load.weight_loaded_lbs)} lbs • Lines: {fmtNum(loadItems.length)}</div>
                              <div className="mt-1 text-xs text-slate-500">PO: {load.po_number || selectedJob.po_number || "—"} • Ship to: {load.ship_to_name || selectedJob.ship_to_name || "—"}</div>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Click to select</span>
                          </div>
                        </button>
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                          <button type="button" onClick={() => printSavedShippingTicket(load)} className="rounded-xl border border-sky-700 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50">Print Ticket</button>
                          <button type="button" onClick={() => {
                            setSelectedLoadId(load.id);
                            setShippingForm({
                              id: load.id,
                              load_number: load.load_number || "",
                              ship_date: load.ship_date || "",
                              ship_to_name: load.ship_to_name || "",
                              ship_to_address: load.ship_to_address || "",
                              po_number: load.po_number || "",
                              shipping_signature_name: load.shipping_signature_name || "",
                              received_signature_name: load.received_signature_name || "",
                              ticket_notes: load.ticket_notes || "",
                            });
                            setShippingItems(loadItems.length ? loadItems.map((item) => ({
                              id: item.id,
                              mark: item.mark || "",
                              quantity: String(item.quantity ?? ""),
                              weight_lbs: String(item.weight_lbs ?? ""),
                              description: item.description || "",
                              sequence: item.sequence || "",
                              finish: item.finish || "",
                            })) : [makeLineDraft()]);
                          }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Load Into Editor</button>
                          <button type="button" onClick={() => deleteShippingLoad(load)} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete Load</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  </div>
              </details>
              <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer text-lg font-semibold text-slate-950">Advanced: XML / KSS Imports</summary>
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => xmlInputRef.current?.click()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Upload XML</button>
                    <button type="button" onClick={() => kssInputRef.current?.click()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Upload KSS</button>
                  </div>
                  <input ref={xmlInputRef} type="file" accept=".xml,text/xml" multiple className="hidden" onChange={async (e) => { const files = Array.from(e.target.files || []); for (const file of files) await uploadImportFile(file, "xml"); }} />
                  <input ref={kssInputRef} type="file" accept=".kss,.txt" multiple className="hidden" onChange={async (e) => { const files = Array.from(e.target.files || []); for (const file of files) await uploadImportFile(file, "kss"); }} />

                  {selectedJobImports.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No imports for this job yet.</div> : null}

                  {selectedJobImports.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <button type="button" onClick={() => setSelectedImportBatchIds(selectedJobImports.map((batch) => batch.id))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Select All Imports</button>
                      <button type="button" onClick={() => setSelectedImportBatchIds([])} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear Import Selection</button>
                      <button type="button" onClick={copySelectedImportsToShipping} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">Copy Selected Imports To Shipping</button>
                      <span className="text-sm text-slate-500">{selectedImportBatchIds.length} selected</span>
                    </div>
                  ) : null}

                  {selectedJobImports.map((batch) => {
                    const rowCount = (importItemsByBatch[batch.id] || []).length;
                    const isSelected = selectedImportBatchIds.includes(batch.id);
                    return (
                      <div key={batch.id} className={`rounded-2xl border p-4 ${isSelected ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-slate-50"}`}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-semibold text-slate-950">{batch.original_filename}</div>
                            <div className="text-sm text-slate-500">{batch.file_type.toUpperCase()} • {rowCount} parsed rows</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => toggleImportBatch(batch.id)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{isSelected ? "Selected" : "Select"}</button>
                            <button type="button" onClick={() => copyImportItemsToShipping(batch.id)} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50">Copy To Shipping</button>
                            <button type="button" onClick={() => renameImportBatch(batch)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Rename</button>
                            <button type="button" onClick={() => deleteImportBatch(batch)} className="rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {selectedBatch ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-950">Previewing import: {selectedBatch.original_filename}</div>
                          <div className="text-sm text-slate-500">Showing {fmtNum(filteredImportItems.length)} shippable row{filteredImportItems.length === 1 ? "" : "s"}. KSS files use all parsed rows when no MAIN rows exist.</div>
                        </div>
                        <button type="button" onClick={() => copyImportItemsToShipping(selectedBatch.id)} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">Copy Previewed Import To Shipping</button>
                      </div>
                      <input value={importSearch} onChange={(e) => setImportSearch(e.target.value)} placeholder="Search marks, sequence, size, description..." className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
                      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
                        <table className="w-full min-w-[850px] text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Mark</th>
                              <th className="px-3 py-2">Qty</th>
                              <th className="px-3 py-2">Weight</th>
                              <th className="px-3 py-2">Seq</th>
                              <th className="px-3 py-2">Finish</th>
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {filteredImportItems.slice(0, 250).map((item) => {
                              const mark = item.assembly_mark || item.drawing_number || "";
                              const alreadyAdded = shippingDraftMarkKeys.has(normalizeMark(mark));
                              return (
                                <tr key={item.id} className={alreadyAdded ? "bg-emerald-50" : "bg-white"}>
                                  <td className="px-3 py-2 font-medium text-slate-950">{mark || "—"}</td>
                                  <td className="px-3 py-2">{fmtNum(item.quantity)}</td>
                                  <td className="px-3 py-2">{fmtNum(item.weight_lbs)}</td>
                                  <td className="px-3 py-2">{item.sequence || "—"}</td>
                                  <td className="px-3 py-2">{item.finish || "—"}</td>
                                  <td className="px-3 py-2">{item.description || item.dimensions || "—"}</td>
                                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => addImportItemToShipping(item)} className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">{alreadyAdded ? "Added" : "Add"}</button></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
              <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer text-lg font-semibold text-slate-950">QC Checklist Details</summary><div className="mt-5 space-y-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => createChecklist("Final Release Checklist")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">New Final Release</button><button type="button" onClick={() => createChecklist("Shipping Release Checklist")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">New Shipping Release</button></div>{selectedJobQc.length === 0 ? <div className="text-sm text-slate-500">No QC checklists for this job yet.</div> : null}{selectedJobQc.map((checklist) => { const items = qcItemsByChecklist[checklist.id] || []; const openCount = items.filter((item) => !item.is_checked).length; return (<div key={checklist.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><div className="font-semibold text-slate-950">{checklist.checklist_type}</div><div className="text-sm text-slate-500">Date: {fmtDate(checklist.checklist_date)} • Open items: {fmtNum(openCount)}</div></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(checklist.status)}`}>{checklist.status}</span></div><div className="space-y-2">{items.map((item) => (<label key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={item.is_checked} onChange={() => toggleChecklistItem(item)} className="mt-1 h-4 w-4" /><div><div className="font-medium text-slate-900">{item.item_label}</div>{item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}</div></label>))}</div></div>); })}</div></details>
            </>}
          </section>
        </div>

        {showLateJobs ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold text-slate-950">Late Jobs</h2><p className="mt-1 text-sm text-slate-500">These jobs are past their fabrication due date.</p></div><button type="button" onClick={() => setShowLateJobs(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button></div><div className="space-y-3">{lateJobItems.length === 0 ? <div className="text-sm text-slate-500">No late jobs right now.</div> : null}{lateJobItems.map(({ job, due }) => { const health = dueHealth({ ...job, fabrication_due_date: due?.due_date || job.fabrication_due_date }); return (<button key={`${job.id}-${due?.id || "main"}`} type="button" onClick={() => { setSelectedJobId(job.id); setShowLateJobs(false); }} className={`w-full rounded-2xl border p-4 text-left shadow-sm hover:border-sky-400 ${health.cls}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-semibold text-slate-950">{job.job_number || "—"} — {job.job_name || "Untitled job"}</div><div className="mt-1 text-sm opacity-80">{due?.label ? `${due.label} • ` : ""}PO: {job.po_number || "—"} • Status: {job.pm_status || "—"}</div></div><div className="text-sm font-semibold text-red-700">{health.label}</div></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-4"><div><span className="font-medium">Due:</span> {fmtDate(due?.due_date || job.fabrication_due_date)}</div><div><span className="font-medium">Qty:</span> {due?.quantity ?? "—"}</div><div><span className="font-medium">Done:</span> {fmtNum(job.percent_complete)}%</div><div><span className="font-medium">Open QC:</span> {fmtNum(job.open_qc_count)}</div></div></button>); })}</div></div></div> : null}

        {showOpenQc ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold text-slate-950">Open QC Details</h2><p className="mt-1 text-sm text-slate-500">This shows exactly what is behind the open QC count.</p></div><button type="button" onClick={() => setShowOpenQc(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button></div><div className="space-y-4">{openQcDetails.length === 0 ? <div className="text-sm text-slate-500">No open QC issues right now.</div> : null}{openQcDetails.map((qc) => (<div key={qc.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="font-semibold text-slate-950">{qc.job?.job_number || "—"} — {qc.job?.job_name || "Unknown job"}</div><div className="text-sm text-slate-600">{qc.checklist_type}</div><div className="text-xs text-slate-500">Checklist date: {fmtDate(qc.checklist_date)}</div></div><div className="text-right text-xs text-slate-500"><div>Status: {qc.status}</div><div>Unchecked items: {fmtNum(qc.itemCount)}</div></div></div><div className="mt-3 space-y-2">{(qcItemsByChecklist[qc.id] || []).filter((item) => !item.is_checked).map((item) => (<div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><div className="font-medium text-slate-950">{item.item_label}</div>{item.note ? <div className="text-xs text-slate-500">{item.note}</div> : null}</div>))}</div></div>))}</div></div></div> : null}
      </div>
    </div>
  );
}
