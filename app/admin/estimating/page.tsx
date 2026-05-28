"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  blankPiece,
  calcPiece,
  createDefaultStore,
  decimal,
  defaultSettings,
  ensureEstimate,
  loadStore,
  money,
  n,
  saveStore,
  summarizeEstimate,
  type EstimateJobInfo,
  type EstimatePiece,
  type EstimateSettings,
  type JobEstimate,
  type LaborCode,
  type WeldThreshold,
} from "@/lib/estimating";
import { buildFullFabWorkbookBlob } from "@/lib/estimating-export";
import { shapeCatalog as starterShapeCatalog, type ShapeCatalogItem } from "@/lib/shape-catalog";
import { type WeldCatalogRow, weldCatalog as starterWeldCatalog } from "@/lib/weld-catalog";

import {
  deleteAssemblyTemplate,
  deleteShapeCatalogItem,
  deleteWeldCatalogItem,
  listAssemblyTemplates,
  listShapeCatalogItems,
  listWeldCatalogItems,
  loadDbEstimate,
  loadDbSettings,
  saveAssemblyTemplate,
  saveDbEstimate,
  saveDbSettings,
  seedShapeCatalogItems,
  seedWeldCatalogItems,
  upsertShapeCatalogItem,
  upsertWeldCatalogItem,
  type AssemblyTemplate,
  type DbShapeCatalogItem,
  type DbWeldCatalogItem,
} from "@/lib/estimating-db";


type JobLite = {
  id: string;
  job_number: string | null;
  job_name: string | null;
  status: string | null;
  quoted_amount: number | null;
  projected_finish_date: string | null;
  percent_complete: number | null;
  is_archived: boolean | null;
};

type ShapeEditor = {
  id?: string;
  family: string;
  shape: string;
  description: string;
  lbsPerFoot: number;
  defaultGrade: string;
  sortOrder: number;
};

type WeldEditor = {
  id?: string;
  shopSetup: string;
  weldType: string;
  weldProcess: string;
  thickness: string;
  ratePerHour: number;
  weightPerFt: number;
  costPerLb: number;
  sortOrder: number;
};

type MaterialMasterRow = {
  id: string;
  shapeCode: string;
  shapeName: string;
  sizeLabel: string;
  weightPerFt: number;
  grade: string;
};

type TabKey = "overview" | "pieces" | "catalog" | "settings";

const TEMPLATE_STORAGE_KEY = "stakd-estimating-templates-v1";

function isJobArchived(job: JobLite) {
  const status = (job.status || "").trim().toLowerCase();
  return Boolean(
    job.is_archived ||
      (typeof job.percent_complete === "number" && job.percent_complete >= 100) ||
      ["lost", "complete", "completed", "closed", "archived"].includes(status)
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function summarizeByField(estimate: JobEstimate, settings: EstimateSettings, field: "category" | "subCategory" | "sequence") {
  const grouped = new Map<string, { pieces: number; qty: number; weight: number; hours: number; total: number }>();
  for (const piece of estimate.pieces) {
    const key = (piece[field] || "Unassigned").trim() || "Unassigned";
    const calc = calcPiece(piece, settings, estimate.pieces);
    const current = grouped.get(key) ?? { pieces: 0, qty: 0, weight: 0, hours: 0, total: 0 };
    current.pieces += 1;
    current.qty += calc.effectiveQuantity;
    current.weight += calc.totalWeight;
    current.hours += calc.totalHours;
    current.total += calc.lineTotal;
    grouped.set(key, current);
  }
  return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function loadLocalTemplates(): AssemblyTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTemplates(templates: AssemblyTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function clonePiecesForInsert(source: EstimatePiece[]) {
  const idMap = new Map<string, string>();
  const firstPass = source.map((piece, index) => {
    const next = { ...blankPiece(index + 1), ...piece, id: blankPiece(index + 1).id };
    idMap.set(piece.id, next.id);
    return next;
  });
  return firstPass.map((piece) => ({
    ...piece,
    mainPieceId: piece.mainPieceId ? idMap.get(piece.mainPieceId) ?? "" : "",
  }));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function toShapeEditor(row?: DbShapeCatalogItem | null): ShapeEditor {
  return {
    id: row?.id,
    family: row?.family ?? "",
    shape: row?.shape ?? "",
    description: row?.description ?? "",
    lbsPerFoot: row?.lbsPerFoot ?? 0,
    defaultGrade: row?.defaultGrade ?? "A992",
    sortOrder: row?.sortOrder ?? 0,
  };
}

function toWeldEditor(row?: DbWeldCatalogItem | null): WeldEditor {
  return {
    id: row?.id,
    shopSetup: row?.shopSetup ?? "2024.1",
    weldType: row?.weldType ?? "Fillet Weld",
    weldProcess: row?.weldProcess ?? "Semi-Automatic",
    thickness: row?.thickness ?? "",
    ratePerHour: row?.ratePerHour ?? 0,
    weightPerFt: row?.weightPerFt ?? 0,
    costPerLb: row?.costPerLb ?? 0.9,
    sortOrder: row?.sortOrder ?? 0,
  };
}

export default function AdminEstimatingPage() {
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [settings, setSettings] = useState<EstimateSettings>(structuredClone(defaultSettings));
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [templates, setTemplates] = useState<AssemblyTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [catalogFamily, setCatalogFamily] = useState("All");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [weldCatalogShopSetup, setWeldCatalogShopSetup] = useState("2024.1");
  const [weldCatalogType, setWeldCatalogType] = useState("Fillet Weld");
  const [weldCatalogProcess, setWeldCatalogProcess] = useState("Semi-Automatic");
  const [shapeCatalogRows, setShapeCatalogRows] = useState<DbShapeCatalogItem[]>(starterShapeCatalog.map((row, index) => ({ id: `starter-shape-${index}`, family: row.family, shape: row.shape, description: row.description, lbsPerFoot: row.lbsPerFoot, defaultGrade: row.defaultGrade ?? "A992", sortOrder: index, isArchived: false })));
  const [weldCatalogRows, setWeldCatalogRows] = useState<DbWeldCatalogItem[]>(starterWeldCatalog.map((row, index) => ({ id: `starter-weld-${index}`, shopSetup: row.shopSetup, weldType: row.weldType, weldProcess: row.weldProcess, thickness: row.thickness, ratePerHour: row.ratePerHour, weightPerFt: row.weightPerFt, costPerLb: row.costPerLb, sortOrder: index, isArchived: false })));
  const [catalogsUsingFallback, setCatalogsUsingFallback] = useState(false);
  const [materialMasterRows, setMaterialMasterRows] = useState<MaterialMasterRow[]>([]);
  const [materialShapeFilter, setMaterialShapeFilter] = useState("All");
  const [materialSizeQuickSearch, setMaterialSizeQuickSearch] = useState("");
  const [shapeEditor, setShapeEditor] = useState<ShapeEditor>(toShapeEditor());
  const [weldEditor, setWeldEditor] = useState<WeldEditor>(toWeldEditor());
  const [catalogSaving, setCatalogSaving] = useState(false);

  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dirtyEstimate, setDirtyEstimate] = useState(false);
  const [dirtySettings, setDirtySettings] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingJobs(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("id,job_number,job_name,status,quoted_amount,projected_finish_date,percent_complete,is_archived")
        .order("job_number", { ascending: false });
      if (!active) return;
      if (error) {
        setJobsError(error.message);
        setJobs([]);
      } else {
        const nextJobs = ((data ?? []) as JobLite[]).filter((job) => !!job.id);
        setJobs(nextJobs);
        const first = nextJobs.find((job) => !isJobArchived(job)) ?? nextJobs[0];
        setSelectedJobId(first?.id || "");
      }
      setLoadingJobs(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Reliable Supabase readiness check. If this table is readable, the estimating
        // persistence schema is installed and the yellow fallback warning should stay off.
        const { error: readyError } = await supabase
          .from("estimating_settings")
          .select("id")
          .limit(1);

        if (readyError) throw readyError;
        if (!active) return;

        setUsingFallback(false);

        const [dbSettings, dbTemplates] = await Promise.all([
          loadDbSettings().catch(() => null),
          listAssemblyTemplates().catch(() => []),
        ]);

        if (!active) return;
        if (dbSettings) setSettings({ ...structuredClone(defaultSettings), ...dbSettings });
        setTemplates(dbTemplates);
      } catch {
        if (!active) return;
        setUsingFallback(true);
        const local = loadStore();
        setSettings(local.settings);
        setTemplates(loadLocalTemplates());
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [shapeRows, weldRows] = await Promise.all([listShapeCatalogItems(), listWeldCatalogItems()]);
        if (!active) return;
        if (shapeRows.length) setShapeCatalogRows(shapeRows);
        if (weldRows.length) setWeldCatalogRows(weldRows);
        setCatalogsUsingFallback(!shapeRows.length || !weldRows.length);
      } catch {
        if (!active) return;
        setCatalogsUsingFallback(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("estimating_material_sizes")
        .select("id,size_label,weight_per_ft,grade, estimating_material_shapes(shape_code, shape_name)")
        .eq("is_active", true)
        .order("size_label", { ascending: true });
      if (!active || error) return;
      const rows = ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        shapeCode: row.estimating_material_shapes?.shape_code ?? "",
        shapeName: row.estimating_material_shapes?.shape_name ?? row.estimating_material_shapes?.shape_code ?? "",
        sizeLabel: row.size_label ?? "",
        weightPerFt: Number(row.weight_per_ft ?? 0),
        grade: row.grade ?? "",
      })).filter((row) => row.shapeCode && row.sizeLabel);
      setMaterialMasterRows(rows);
    })();
    return () => { active = false; };
  }, []);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJob) return;
    let active = true;
    setLoadingEstimate(true);
    setSelectedPieceIds([]);
    setSaveMessage(null);
    (async () => {
      try {
        if (usingFallback) {
          const local = loadStore();
          const next = ensureEstimate(
            local.estimatesByJobId[selectedJob.id] ?? {},
            selectedJob.id,
            selectedJob.job_number || "UNASSIGNED",
            selectedJob.job_name || "Untitled Job"
          );
          if (active) setEstimate(next);
        } else {
          let next = await loadDbEstimate(
            selectedJob.id,
            selectedJob.job_number || "UNASSIGNED",
            selectedJob.job_name || "Untitled Job"
          );
          // If Supabase is empty but this browser has a local backup, show the backup so Save can restore it.
          if (!next.pieces.length) {
            const local = loadStore();
            const backup = local.estimatesByJobId[selectedJob.id];
            if (backup?.pieces?.length) {
              next = ensureEstimate(backup, selectedJob.id, selectedJob.job_number || "UNASSIGNED", selectedJob.job_name || "Untitled Job");
              setSaveMessage("Loaded local backup — click Save to restore this estimate to the cloud.");
            }
          }
          if (active) setEstimate(next);
        }
      } catch {
        const local = loadStore();
        const next = ensureEstimate(
          local.estimatesByJobId[selectedJob.id] ?? {},
          selectedJob.id,
          selectedJob.job_number || "UNASSIGNED",
          selectedJob.job_name || "Untitled Job"
        );
        if (active) {
          setEstimate(next);
        }
      } finally {
        if (active) {
          setDirtyEstimate(false);
          setLoadingEstimate(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedJob, usingFallback]);

  const shapeFamilies = useMemo(() => ["All", ...uniqueValues(shapeCatalogRows.filter((row) => !row.isArchived).map((row) => row.family))], [shapeCatalogRows]);
  const weldShopSetups = useMemo(() => uniqueValues(weldCatalogRows.filter((row) => !row.isArchived).map((row) => row.shopSetup)), [weldCatalogRows]);
  const weldTypes = useMemo(() => uniqueValues(weldCatalogRows.filter((row) => !row.isArchived).map((row) => row.weldType)), [weldCatalogRows]);
  const weldProcesses = useMemo(() => uniqueValues(weldCatalogRows.filter((row) => !row.isArchived).map((row) => row.weldProcess)), [weldCatalogRows]);

  const filteredShapeCatalog = useMemo(() => {
    const needle = catalogQuery.trim().toLowerCase();
    return shapeCatalogRows.filter((row) => {
      if (row.isArchived) return false;
      if (catalogFamily !== "All" && row.family !== catalogFamily) return false;
      if (!needle) return true;
      return [row.family, row.shape, row.description, String(row.lbsPerFoot), row.defaultGrade].join(" ").toLowerCase().includes(needle);
    });
  }, [catalogFamily, catalogQuery, shapeCatalogRows]);

  const filteredWeldCatalog = useMemo(() => weldCatalogRows.filter((row) => !row.isArchived && row.shopSetup === weldCatalogShopSetup && row.weldType === weldCatalogType && row.weldProcess === weldCatalogProcess), [weldCatalogProcess, weldCatalogRows, weldCatalogShopSetup, weldCatalogType]);

  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!showArchivedJobs && isJobArchived(job)) return false;
      if (!needle) return true;
      return [job.job_number, job.job_name, job.status].join(" ").toLowerCase().includes(needle);
    });
  }, [jobs, query, showArchivedJobs]);

  useEffect(() => {
    if (!filteredJobs.length) return;
    if (!filteredJobs.some((job) => job.id === selectedJobId)) setSelectedJobId(filteredJobs[0].id);
  }, [filteredJobs, selectedJobId]);

  const mainPieceOptions = useMemo(() => (estimate?.pieces ?? []).filter((piece) => piece.isMainPiece), [estimate]);
  const selectedEditorPiece = useMemo(() => {
    if (!estimate?.pieces.length) return null;
    const selectedId = selectedPieceIds[0] || estimate.pieces[0].id;
    return estimate.pieces.find((piece) => piece.id === selectedId) ?? estimate.pieces[0];
  }, [estimate, selectedPieceIds]);
  const materialShapeOptions = useMemo(() => ["All", ...uniqueValues(materialMasterRows.map((row) => row.shapeCode))], [materialMasterRows]);
  const filteredMaterialMasterRows = useMemo(() => {
    const sizeNeedle = materialSizeQuickSearch.trim().toUpperCase().replace(/\s+/g, "");
    return materialMasterRows.filter((row) => {
      if (materialShapeFilter !== "All" && row.shapeCode !== materialShapeFilter) return false;
      if (!sizeNeedle) return true;
      const normalized = row.sizeLabel.toUpperCase().replace(/\s+/g, "");
      const withoutShape = normalized.startsWith(row.shapeCode) ? normalized.slice(row.shapeCode.length) : normalized;
      return normalized.includes(sizeNeedle) || withoutShape.includes(sizeNeedle);
    });
  }, [materialMasterRows, materialShapeFilter, materialSizeQuickSearch]);
  const summary = useMemo(() => (estimate ? summarizeEstimate(estimate, settings) : null), [estimate, settings]);
  const categoryBreakdown = useMemo(() => (estimate ? summarizeByField(estimate, settings, "category") : []), [estimate, settings]);
  const subCategoryBreakdown = useMemo(() => (estimate ? summarizeByField(estimate, settings, "subCategory") : []), [estimate, settings]);
  const sequenceBreakdown = useMemo(() => (estimate ? summarizeByField(estimate, settings, "sequence") : []), [estimate, settings]);

  function patchEstimate(mutator: (current: JobEstimate) => JobEstimate) {
    setEstimate((current) => {
      if (!current) return current;
      const next = mutator(current);
      setDirtyEstimate(true);
      return next;
    });
  }

  function patchInfo(field: keyof EstimateJobInfo, value: string | number) {
    patchEstimate((current) => ({ ...current, info: { ...current.info, [field]: value } }));
  }

  function applyShapeCatalog(item: ShapeCatalogItem) {
    if (!estimate) return;
    const targetId = selectedPieceIds[0] || estimate.pieces[estimate.pieces.length - 1]?.id;
    if (!targetId) {
      patchEstimate((current) => ({
        ...current,
        pieces: [...current.pieces, { ...blankPiece(current.pieces.length + 1), shape: item.shape, description: item.description, grade: item.defaultGrade || "A992", manualWeightLbs: null }],
      }));
      return;
    }
    patchPiece(targetId, { shape: item.shape, description: item.description, grade: item.defaultGrade || "A992", manualWeightLbs: null });
  }

  function applyWeldCatalog(thickness: string) {
    if (!estimate) return;
    const row = weldCatalogRows.find((item) => !item.isArchived && item.shopSetup === weldCatalogShopSetup && item.weldType === weldCatalogType && item.weldProcess === weldCatalogProcess && item.thickness === thickness);
    if (!row) return;
    const targetIds = selectedPieceIds.length ? selectedPieceIds : estimate.pieces.slice(-1).map((piece) => piece.id);
    if (!targetIds.length) return;
    patchEstimate((current) => ({
      ...current,
      pieces: current.pieces.map((piece) => targetIds.includes(piece.id) ? ({ ...piece, shopSetup: row.shopSetup, weldType: row.weldType, weldProcess: row.weldProcess, weldThickness: row.thickness }) : piece),
    }));
  }


  async function saveShapeCatalogForm() {
    if (!shapeEditor.family.trim() || !shapeEditor.shape.trim()) {
      setSaveMessage("Shape family and shape are required");
      return;
    }
    setCatalogSaving(true);
    try {
      const saved = await upsertShapeCatalogItem(shapeEditor);
      setShapeCatalogRows((prev) => {
        const next = prev.filter((row) => row.id !== saved.id);
        return [...next, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.family.localeCompare(b.family) || a.shape.localeCompare(b.shape));
      });
      setShapeEditor(toShapeEditor());
      setCatalogsUsingFallback(false);
      setSaveMessage("Shape catalog saved");
    } catch (error: any) {
      setSaveMessage(error?.message || "Shape save failed");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function removeShapeCatalogRow(id?: string) {
    if (!id) return;
    setCatalogSaving(true);
    try {
      await deleteShapeCatalogItem(id);
      setShapeCatalogRows((prev) => prev.filter((row) => row.id !== id));
      if (shapeEditor.id === id) setShapeEditor(toShapeEditor());
      setSaveMessage("Shape catalog row deleted");
    } catch (error: any) {
      setSaveMessage(error?.message || "Shape delete failed");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function saveWeldCatalogForm() {
    if (!weldEditor.shopSetup.trim() || !weldEditor.weldType.trim() || !weldEditor.weldProcess.trim() || !weldEditor.thickness.trim()) {
      setSaveMessage("Shop setup, weld type, process, and thickness are required");
      return;
    }
    setCatalogSaving(true);
    try {
      const saved = await upsertWeldCatalogItem(weldEditor);
      setWeldCatalogRows((prev) => {
        const next = prev.filter((row) => row.id !== saved.id);
        return [...next, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.shopSetup.localeCompare(b.shopSetup) || a.weldType.localeCompare(b.weldType) || a.weldProcess.localeCompare(b.weldProcess) || a.thickness.localeCompare(b.thickness));
      });
      setWeldEditor(toWeldEditor());
      setCatalogsUsingFallback(false);
      setSaveMessage("Weld catalog saved");
    } catch (error: any) {
      setSaveMessage(error?.message || "Weld save failed");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function removeWeldCatalogRow(id?: string) {
    if (!id) return;
    setCatalogSaving(true);
    try {
      await deleteWeldCatalogItem(id);
      setWeldCatalogRows((prev) => prev.filter((row) => row.id !== id));
      if (weldEditor.id === id) setWeldEditor(toWeldEditor());
      setSaveMessage("Weld catalog row deleted");
    } catch (error: any) {
      setSaveMessage(error?.message || "Weld delete failed");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function seedStarterShapeCatalog() {
    setCatalogSaving(true);
    try {
      const rows = await seedShapeCatalogItems();
      setShapeCatalogRows(rows);
      setCatalogsUsingFallback(false);
      setSaveMessage("Starter shape catalog loaded");
    } catch (error: any) {
      setSaveMessage(error?.message || "Could not load starter shape catalog");
    } finally {
      setCatalogSaving(false);
    }
  }

  async function seedStarterWeldCatalog() {
    setCatalogSaving(true);
    try {
      const rows = await seedWeldCatalogItems();
      setWeldCatalogRows(rows);
      setCatalogsUsingFallback(false);
      setSaveMessage("Starter weld catalog loaded");
    } catch (error: any) {
      setSaveMessage(error?.message || "Could not load starter weld catalog");
    } finally {
      setCatalogSaving(false);
    }
  }

  function patchPiece(pieceId: string, patch: Partial<EstimatePiece>) {
    patchEstimate((current) => ({
      ...current,
      pieces: current.pieces.map((piece) => {
        if (piece.id !== pieceId) return piece;
        const next = { ...piece, ...patch };
        if (next.isMainPiece) next.mainPieceId = "";
        if (next.mainPieceId) next.isMainPiece = false;
        return next;
      }),
    }));
  }

  function applyMaterialToPiece(pieceId: string, materialId: string) {
    const material = materialMasterRows.find((row) => row.id === materialId);
    if (!material) return;
    patchPiece(pieceId, { shape: material.sizeLabel, description: material.shapeName, grade: material.grade || "A992", manualWeightLbs: null });
  }

  function updateSelectedEditorPiece(patch: Partial<EstimatePiece>) {
    if (!selectedEditorPiece) return;
    patchPiece(selectedEditorPiece.id, patch);
  }

  function handleEditorEnterKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const target = event.target as HTMLElement | null;
    if (!target || !["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    event.preventDefault();
    const container = event.currentTarget;
    const focusables = Array.from(container.querySelectorAll<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'))
      .filter((el) => el.offsetParent !== null);
    const currentIndex = focusables.indexOf(target);
    const next = focusables[currentIndex + 1] ?? focusables[0];
    next?.focus();
    if (next instanceof HTMLInputElement) next.select();
  }

  function applyQuickMaterialSearch(pieceId: string) {
    const typed = materialSizeQuickSearch.trim().toUpperCase().replace(/\s+/g, "");
    if (!typed) return;
    const match = filteredMaterialMasterRows.find((row) => {
      const normalized = row.sizeLabel.toUpperCase().replace(/\s+/g, "");
      const withoutShape = normalized.startsWith(row.shapeCode) ? normalized.slice(row.shapeCode.length) : normalized;
      return normalized === typed || withoutShape === typed;
    }) ?? filteredMaterialMasterRows[0];
    if (match) applyMaterialToPiece(pieceId, match.id);
  }

  function addPiece() {
    if (!estimate) return;
    const nextPiece = blankPiece(estimate.pieces.length + 1);
    patchEstimate((current) => ({
      ...current,
      pieces: [...current.pieces, nextPiece],
    }));
    setSelectedPieceIds([nextPiece.id]);
    setActiveTab("pieces");
    window.setTimeout(() => {
      const first = document.querySelector<HTMLElement>('[data-piece-editor="true"] input, [data-piece-editor="true"] select');
      first?.focus();
      if (first instanceof HTMLInputElement) first.select();
    }, 50);
  }

  function deleteSelectedPieces() {
    if (!selectedPieceIds.length) return;
    patchEstimate((current) => ({
      ...current,
      pieces: current.pieces
        .filter((piece) => !selectedPieceIds.includes(piece.id))
        .map((piece) => (selectedPieceIds.includes(piece.mainPieceId) ? { ...piece, mainPieceId: "" } : piece)),
    }));
    setSelectedPieceIds([]);
  }

  function copySelectedPieces() {
    if (!estimate || !selectedPieceIds.length) return;
    const source = estimate.pieces.filter((piece) => selectedPieceIds.includes(piece.id));
    const clones = clonePiecesForInsert(source).map((piece, index) => ({ ...piece, item: piece.item + (index + 1) * 10 }));
    patchEstimate((current) => ({ ...current, pieces: [...current.pieces, ...clones] }));
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedPieceIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((row) => row !== id)));
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedPieceIds(checked ? (estimate?.pieces ?? []).map((piece) => piece.id) : []);
  }

  async function saveAll() {
    if (!estimate) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      // Always keep a local browser backup first. This protects takeoffs if Supabase rejects a save.
      const local = loadStore();
      const nextStore = {
        ...local,
        settings,
        estimatesByJobId: { ...local.estimatesByJobId, [estimate.jobId]: estimate },
      };
      saveStore(nextStore);
      saveLocalTemplates(templates);

      if (!usingFallback) {
        await Promise.all([
          dirtySettings ? saveDbSettings(settings) : Promise.resolve(),
          saveDbEstimate(estimate),
        ]);
      }
      setDirtyEstimate(false);
      setDirtySettings(false);
      setSaveMessage(`Saved ${new Date().toLocaleTimeString()}`);
    } catch (error: any) {
      setSaveMessage(error?.message || "Save failed — local backup kept");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedAsTemplate() {
    if (!estimate) return;
    const pieces = selectedPieceIds.length ? estimate.pieces.filter((piece) => selectedPieceIds.includes(piece.id)) : estimate.pieces;
    if (!pieces.length || !templateName.trim()) return;
    const template: AssemblyTemplate = {
      id: "",
      name: templateName.trim(),
      notes: templateNotes.trim(),
      pieces,
    };
    try {
      if (usingFallback) {
        const next = [...templates, { ...template, id: `tmpl-${Date.now()}` }];
        setTemplates(next);
        saveLocalTemplates(next);
      } else {
        await saveAssemblyTemplate(template);
        setTemplates(await listAssemblyTemplates());
      }
      setTemplateName("");
      setTemplateNotes("");
      setSaveMessage("Assembly template saved");
    } catch (error: any) {
      setSaveMessage(error?.message || "Template save failed");
    }
  }

  function insertSelectedTemplate() {
    if (!estimate || !selectedTemplateId) return;
    const template = templates.find((row) => row.id === selectedTemplateId);
    if (!template) return;
    const inserted = clonePiecesForInsert(template.pieces).map((piece, index) => ({
      ...piece,
      page: estimate.pieces.at(-1)?.page ?? 1,
      item: (estimate.pieces.at(-1)?.item ?? 0) + (index + 1) * 10,
    }));
    patchEstimate((current) => ({ ...current, pieces: [...current.pieces, ...inserted] }));
    setActiveTab("pieces");
  }

  async function removeTemplate() {
    if (!selectedTemplateId) return;
    try {
      if (usingFallback) {
        const next = templates.filter((row) => row.id !== selectedTemplateId);
        setTemplates(next);
        saveLocalTemplates(next);
      } else {
        await deleteAssemblyTemplate(selectedTemplateId);
        setTemplates(await listAssemblyTemplates());
      }
      setSelectedTemplateId("");
      setSaveMessage("Template deleted");
    } catch (error: any) {
      setSaveMessage(error?.message || "Template delete failed");
    }
  }

  async function exportEstimate() {
    if (!estimate || !summary) return;
    try {
      setSaveMessage("Building Excel export...");
      const blob = await buildFullFabWorkbookBlob(estimate, summary, settings);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${estimate.jobNumber || "estimate"}-Full-Fab.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSaveMessage("Excel export ready");
    } catch (error: any) {
      setSaveMessage(error?.message || "Excel export failed");
    }
  }

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (activeTab !== "pieces") return;
      if (event.key === "F1") {
        event.preventDefault();
        addPiece();
      } else if (event.key === "F2") {
        event.preventDefault();
        deleteSelectedPieces();
      } else if (event.key === "F3") {
        event.preventDefault();
        copySelectedPieces();
      } else if (event.key === "F4") {
        event.preventDefault();
        void saveAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, selectedPieceIds, estimate, settings, dirtyEstimate, dirtySettings, templates, usingFallback]);

  const metrics = [
    ["Pieces", summary?.pieceCount ?? 0],
    ["Weight", summary ? `${decimal(summary.totalWeight, 0)} lb` : "0 lb"],
    ["Tons", summary ? decimal(summary.totalTons, 2) : "0.00"],
    ["Labor", summary ? `${decimal(summary.laborHours.total, 2)} hr` : "0.00 hr"],
    ["Grand Total", summary ? money(summary.grandTotal) : money(0)],
  ];

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Image src="/stakd-logo.png" alt="STAKD" width={38} height={38} />
              <div>
                <div className="text-2xl font-semibold">Estimating</div>
                <div className="text-sm text-zinc-500">Persistent job estimates, reusable assemblies, and labor-rate pricing.</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={addPiece} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white">New (F1)</button>
              <button onClick={deleteSelectedPieces} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Delete (F2)</button>
              <button onClick={copySelectedPieces} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Copy (F3)</button>
              <button onClick={() => void saveAll()} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Save (F4)</button>
              <button onClick={() => void exportEstimate()} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Export Excel</button>
            </div>
          </div>
          {usingFallback ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Supabase estimating tables are not installed yet, so this page is using browser fallback storage. Run the included SQL file to make saving shared and persistent.</div> : null}
          {saveMessage ? <div className="mt-3 text-sm text-zinc-600">{saveMessage}</div> : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Jobs</div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none" />
            <label className="mb-3 flex items-center gap-2 text-sm text-zinc-600"><input type="checkbox" checked={showArchivedJobs} onChange={(e) => setShowArchivedJobs(e.target.checked)} /> Show archived / lost / complete</label>
            <div className="max-h-[72vh] space-y-2 overflow-auto pr-1">
              {loadingJobs ? <div className="text-sm text-zinc-500">Loading jobs...</div> : null}
              {jobsError ? <div className="text-sm text-red-600">{jobsError}</div> : null}
              {filteredJobs.map((job) => (
                <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`w-full rounded-xl border px-3 py-3 text-left ${selectedJobId === job.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-zinc-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{job.job_number || "UNASSIGNED"}</div>
                    {isJobArchived(job) ? <span className={`rounded-full px-2 py-0.5 text-[11px] ${selectedJobId === job.id ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700"}`}>Archived</span> : null}
                  </div>
                  <div className={`mt-1 text-sm ${selectedJobId === job.id ? "text-zinc-200" : "text-zinc-600"}`}>{job.job_name || "Untitled Job"}</div>
                  <div className={`mt-2 text-xs ${selectedJobId === job.id ? "text-zinc-300" : "text-zinc-500"}`}>{job.status || "No status"}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-[80vh] flex-col gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold">{selectedJob?.job_number || "No job selected"}</div>
                  <div className="text-sm text-zinc-500">{selectedJob?.job_name || "Choose a job from the left"}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["overview", "pieces", "catalog", "settings"] as TabKey[]).map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${activeTab === tab ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white"}`}>{tab}</button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {metrics.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
                    <div className="mt-1 text-lg font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {loadingEstimate ? <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm">Loading estimate...</div> : null}

            {!loadingEstimate && estimate && activeTab === "overview" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Estimate info</div>
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {[
                      ["Estimator", "estimator"], ["Estimate #", "estimateNumber"], ["Estimate Date", "estimateDate"], ["Estimate Name", "estimateName"],
                      ["Location", "location"], ["County", "county"], ["Group", "groupName"], ["Group 2", "groupName2"],
                    ].map(([label, field]) => (
                      <label key={field} className="text-sm">
                        <div className="mb-1 text-zinc-500">{label}</div>
                        <input value={(estimate.info as any)[field] ?? ""} onChange={(e) => patchInfo(field as keyof EstimateJobInfo, e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none" />
                      </label>
                    ))}
                    {[ ["Field bolts", "fieldBoltsEach"], ["Detailing", "detailingCost"], ["Buyout", "buyoutCost"], ["Inbound freight", "inboundFreightCost"], ["Jobsite freight", "jobsiteFreightCost"], ["Erection", "erectionCost"] ].map(([label, field]) => (
                      <label key={field} className="text-sm">
                        <div className="mb-1 text-zinc-500">{label}</div>
                        <input type="number" step="0.01" value={n((estimate.info as any)[field])} onChange={(e) => patchInfo(field as keyof EstimateJobInfo, Number(e.target.value))} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {[ ["Category", categoryBreakdown], ["Sub-category", subCategoryBreakdown], ["Sequence", sequenceBreakdown] ].map(([title, rows], index) => (
                    <div key={`${title}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title} report</div>
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Weight</th><th className="px-2 py-2 text-right">Hours</th><th className="px-2 py-2 text-right">Total</th></tr></thead>
                          <tbody>
                            {(rows as any[]).map(([name, row]: any) => (
                              <tr key={name} className="border-b border-zinc-100"><td className="px-2 py-2">{name}</td><td className="px-2 py-2 text-right">{decimal(row.qty, 2)}</td><td className="px-2 py-2 text-right">{decimal(row.weight, 0)}</td><td className="px-2 py-2 text-right">{decimal(row.hours, 2)}</td><td className="px-2 py-2 text-right">{money(row.total)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!loadingEstimate && estimate && activeTab === "pieces" ? (
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Estimate line items</div>
                      <div className="text-xs text-zinc-500">Select a row and edit the full piece in the right panel. This keeps the grid readable without horizontal scrolling.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={addPiece} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white">Add line</button>
                      <button onClick={copySelectedPieces} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Copy selected</button>
                      <button onClick={deleteSelectedPieces} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">Delete selected</button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <table className="min-w-full text-sm">
                      <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500"><th className="px-3 py-2 text-left"><input type="checkbox" checked={estimate.pieces.length > 0 && selectedPieceIds.length === estimate.pieces.length} onChange={(e) => toggleSelectAll(e.target.checked)} /></th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Part</th><th className="px-3 py-2 text-left">Qty</th><th className="px-3 py-2 text-left">Shape / Size</th><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2 text-right">Length</th><th className="px-3 py-2 text-right">Weight</th><th className="px-3 py-2 text-right">Hours</th><th className="px-3 py-2 text-right">Line</th></tr></thead>
                      <tbody>
                        {estimate.pieces.length ? estimate.pieces.map((piece) => {
                          const calc = calcPiece(piece, settings, estimate.pieces);
                          const isActive = selectedEditorPiece?.id === piece.id;
                          return (
                            <tr key={piece.id} onClick={() => setSelectedPieceIds([piece.id])} className={`cursor-pointer border-b border-zinc-100 ${isActive ? "bg-emerald-50" : selectedPieceIds.includes(piece.id) ? "bg-amber-50" : "bg-white hover:bg-zinc-50"}`}>
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedPieceIds.includes(piece.id)} onChange={(e) => toggleSelected(piece.id, e.target.checked)} /></td>
                              <td className="px-3 py-2 font-medium">{piece.item}</td><td className="px-3 py-2">{piece.partNumber || "-"}</td><td className="px-3 py-2">{decimal(piece.quantity, 2)}</td>
                              <td className="px-3 py-2"><div className="font-medium">{piece.shape || "No shape"}</div><div className="text-xs text-zinc-500">{piece.description || "No description"}</div></td>
                              <td className="px-3 py-2">{piece.extraCode}</td><td className="px-3 py-2 text-right">{piece.lengthFeet}' {piece.lengthInches}"</td><td className="px-3 py-2 text-right">{decimal(calc.totalWeight, 0)}</td><td className="px-3 py-2 text-right">{decimal(calc.totalHours, 2)}</td><td className="px-3 py-2 text-right font-medium">{money(calc.lineTotal)}</td>
                            </tr>
                          );
                        }) : (<tr><td colSpan={10} className="px-3 py-10 text-center text-sm text-zinc-500">No estimate lines yet. Click Add line or press F1.</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div data-piece-editor="true" onKeyDown={handleEditorEnterKey} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
                  <div><div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Tekla-style piece editor</div><div className="text-xs text-zinc-500">Edit the selected item here, then save. Enter moves to the next field.</div></div>
                  {selectedEditorPiece ? (<>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm"><div className="mb-1 text-zinc-500">Page</div><input type="number" value={selectedEditorPiece.page} onChange={(e) => updateSelectedEditorPiece({ page: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
                      <label className="text-sm"><div className="mb-1 text-zinc-500">Item</div><input type="number" value={selectedEditorPiece.item} onChange={(e) => updateSelectedEditorPiece({ item: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
                      <label className="text-sm"><div className="mb-1 text-zinc-500">Part #</div><input value={selectedEditorPiece.partNumber} onChange={(e) => updateSelectedEditorPiece({ partNumber: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
                      <label className="text-sm"><div className="mb-1 text-zinc-500">Qty</div><input type="number" step="0.01" value={selectedEditorPiece.quantity} onChange={(e) => updateSelectedEditorPiece({ quantity: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"><div className="mb-2 grid grid-cols-[90px_1fr] gap-2"><label className="text-sm"><div className="mb-1 text-zinc-500">Shape</div><select value={materialShapeFilter} onChange={(e) => { setMaterialShapeFilter(e.target.value); setMaterialSizeQuickSearch(""); }} className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm">{materialShapeOptions.map((shape) => <option key={shape} value={shape}>{shape}</option>)}</select></label><label className="text-sm"><div className="mb-1 text-zinc-500">Size</div><input value={materialSizeQuickSearch} onChange={(e) => setMaterialSizeQuickSearch(e.target.value)} onBlur={() => applyQuickMaterialSearch(selectedEditorPiece.id)} onKeyDown={(e) => { if (e.key === "Enter") applyQuickMaterialSearch(selectedEditorPiece.id); }} placeholder={materialShapeFilter === "W" ? "8X10" : materialShapeFilter === "L" ? "3X3X1/4" : "type size..."} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" /></label></div>
                      <select value={materialMasterRows.find((row) => row.sizeLabel === selectedEditorPiece.shape)?.id || ""} onChange={(e) => applyMaterialToPiece(selectedEditorPiece.id, e.target.value)} className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"><option value="">Choose standard material size...</option>{filteredMaterialMasterRows.map((row) => <option key={row.id} value={row.id}>{row.shapeCode} · {row.sizeLabel} · {decimal(row.weightPerFt, 2)} lb/ft</option>)}</select>
                      <div className="grid grid-cols-2 gap-3"><label className="text-sm"><div className="mb-1 text-zinc-500">Shape / Size</div><input value={selectedEditorPiece.shape} onChange={(e) => updateSelectedEditorPiece({ shape: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label><label className="text-sm"><div className="mb-1 text-zinc-500">Grade</div><input value={selectedEditorPiece.grade} onChange={(e) => updateSelectedEditorPiece({ grade: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label></div>
                      <label className="mt-3 block text-sm"><div className="mb-1 text-zinc-500">Description</div><input value={selectedEditorPiece.description} onChange={(e) => updateSelectedEditorPiece({ description: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
                    </div>
                    <div className="grid grid-cols-2 gap-3"><label className="text-sm"><div className="mb-1 text-zinc-500">Length ft</div><input type="number" step="0.01" value={selectedEditorPiece.lengthFeet} onChange={(e) => updateSelectedEditorPiece({ lengthFeet: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label><label className="text-sm"><div className="mb-1 text-zinc-500">Length in</div><input type="number" step="0.01" value={selectedEditorPiece.lengthInches} onChange={(e) => updateSelectedEditorPiece({ lengthInches: Number(e.target.value) })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label><label className="text-sm"><div className="mb-1 text-zinc-500">Labor Code</div><select value={selectedEditorPiece.extraCode} onChange={(e) => updateSelectedEditorPiece({ extraCode: e.target.value })} className="w-full rounded-lg border border-zinc-300 px-3 py-2">{settings.laborCodes.map((code) => <option key={code.code} value={code.code}>{code.code} - {code.description}</option>)}</select></label><label className="text-sm"><div className="mb-1 text-zinc-500">Additional holes</div><input type="number" step="1" value={selectedEditorPiece.additionalHoles ?? 0} onChange={(e) => updateSelectedEditorPiece({ additionalHoles: Number(e.target.value) || null })} className="w-full rounded-lg border border-zinc-300 px-3 py-2" /></label></div>
                    <div className="grid grid-cols-3 gap-3"><label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm"><input type="checkbox" checked={selectedEditorPiece.isMainPiece} onChange={(e) => updateSelectedEditorPiece({ isMainPiece: e.target.checked, mainPieceId: e.target.checked ? "" : selectedEditorPiece.mainPieceId })} /> Main piece</label><label className="col-span-2 text-sm"><div className="mb-1 text-zinc-500">Tie to main piece</div><select value={selectedEditorPiece.mainPieceId} onChange={(e) => updateSelectedEditorPiece({ mainPieceId: e.target.value, isMainPiece: e.target.value ? false : selectedEditorPiece.isMainPiece })} className="w-full rounded-lg border border-zinc-300 px-3 py-2"><option value="">None</option>{mainPieceOptions.filter((row) => row.id !== selectedEditorPiece.id).map((row) => <option key={row.id} value={row.id}>{row.item} · {row.shape || row.partNumber || "Main"}</option>)}</select></label></div>
                    <div className="rounded-xl border border-zinc-200 p-3"><div className="mb-2 text-sm font-medium">Classification</div><div className="grid grid-cols-3 gap-3"><input value={selectedEditorPiece.category} onChange={(e) => updateSelectedEditorPiece({ category: e.target.value })} placeholder="Category" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" /><input value={selectedEditorPiece.subCategory} onChange={(e) => updateSelectedEditorPiece({ subCategory: e.target.value })} placeholder="Subcategory" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" /><input value={selectedEditorPiece.sequence} onChange={(e) => updateSelectedEditorPiece({ sequence: e.target.value })} placeholder="Sequence" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></div></div>
                    <div className="rounded-xl border border-zinc-200 p-3"><div className="mb-2 text-sm font-medium">Manual adders</div><div className="mb-2 grid grid-cols-2 gap-2"><label className="text-xs text-zinc-500">Manual weld LF<input type="number" step="0.01" value={selectedEditorPiece.manualWeldLinearFeet ?? 0} onChange={(e) => updateSelectedEditorPiece({ manualWeldLinearFeet: Number(e.target.value) || null })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900" /></label><label className="text-xs text-zinc-500">Extra weld hrs<input type="number" step="0.01" value={selectedEditorPiece.addWeldHours ?? 0} onChange={(e) => updateSelectedEditorPiece({ addWeldHours: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900" /></label></div><div className="grid grid-cols-3 gap-2"><input type="number" step="0.01" value={selectedEditorPiece.addCutHours ?? 0} onChange={(e) => updateSelectedEditorPiece({ addCutHours: Number(e.target.value) })} placeholder="Cut hrs" className="rounded-lg border border-zinc-300 px-2 py-2 text-sm" /><input type="number" step="0.01" value={selectedEditorPiece.addMoveHours ?? 0} onChange={(e) => updateSelectedEditorPiece({ addMoveHours: Number(e.target.value) })} placeholder="Move hrs" className="rounded-lg border border-zinc-300 px-2 py-2 text-sm" /><input type="number" step="0.01" value={selectedEditorPiece.addLayoutHours ?? 0} onChange={(e) => updateSelectedEditorPiece({ addLayoutHours: Number(e.target.value) })} placeholder="Layout hrs" className="rounded-lg border border-zinc-300 px-2 py-2 text-sm" /></div></div>
                    {(() => { const calc = calcPiece(selectedEditorPiece, settings, estimate.pieces); return (<div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-900 p-3 text-white"><div><div className="text-xs text-zinc-300">Weight</div><div className="text-lg font-semibold">{decimal(calc.totalWeight, 0)}</div></div><div><div className="text-xs text-zinc-300">Hours</div><div className="text-lg font-semibold">{decimal(calc.totalHours, 2)}</div></div><div><div className="text-xs text-zinc-300">Line</div><div className="text-lg font-semibold">{money(calc.lineTotal)}</div></div></div>); })()}
                  </>) : (<div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">Add or select a piece to edit.</div>)}
                </div>
              </div>
            ) : null}

            {!loadingEstimate && activeTab === "catalog" ? (
              <div className="space-y-4">
                {catalogsUsingFallback ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Catalog tables are empty or not reachable, so the page is showing starter catalog rows in memory. Run the SQL below, then use the Load starter catalog buttons one time.</div> : null}
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Shape catalog</div>
                        <div className="text-xs text-zinc-500">Apply to selected piece row, or add/edit rows for your library.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShapeEditor(toShapeEditor())} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">New shape</button>
                        <button onClick={() => void seedStarterShapeCatalog()} disabled={catalogSaving} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60">Load starter shapes</button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <input value={shapeEditor.family} onChange={(e) => setShapeEditor((prev) => ({ ...prev, family: e.target.value }))} placeholder="Family" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={shapeEditor.shape} onChange={(e) => setShapeEditor((prev) => ({ ...prev, shape: e.target.value }))} placeholder="Shape" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={shapeEditor.defaultGrade} onChange={(e) => setShapeEditor((prev) => ({ ...prev, defaultGrade: e.target.value }))} placeholder="Default grade" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={shapeEditor.description} onChange={(e) => setShapeEditor((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm md:col-span-2" />
                      <input type="number" step="0.01" value={shapeEditor.lbsPerFoot} onChange={(e) => setShapeEditor((prev) => ({ ...prev, lbsPerFoot: Number(e.target.value) }))} placeholder="Lbs/ft" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveShapeCatalogForm()} disabled={catalogSaving} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{shapeEditor.id ? "Update shape" : "Save shape"}</button>
                      <button onClick={() => setShapeEditor(toShapeEditor())} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Clear</button>
                      {shapeEditor.id ? <button onClick={() => void removeShapeCatalogRow(shapeEditor.id)} disabled={catalogSaving} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60">Delete current</button> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select value={catalogFamily} onChange={(e) => setCatalogFamily(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">{shapeFamilies.map((family) => <option key={family} value={family}>{family}</option>)}</select>
                      <input value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Search shape or size" className="min-w-[220px] rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="max-h-[700px] overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500"><th className="px-2 py-2 text-left">Family</th><th className="px-2 py-2 text-left">Shape</th><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-right">lbs/ft</th><th className="px-2 py-2 text-left">Grade</th><th className="px-2 py-2"></th></tr></thead>
                        <tbody>
                          {filteredShapeCatalog.map((item) => (
                            <tr key={item.id} className="border-b border-zinc-100">
                              <td className="px-2 py-2">{item.family}</td>
                              <td className="px-2 py-2 font-medium">{item.shape}</td>
                              <td className="px-2 py-2">{item.description}</td>
                              <td className="px-2 py-2 text-right">{decimal(item.lbsPerFoot, 2)}</td>
                              <td className="px-2 py-2">{item.defaultGrade || ""}</td>
                              <td className="px-2 py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => applyShapeCatalog(item as ShapeCatalogItem)} className="rounded border border-zinc-300 px-2 py-1">Apply</button>
                                  <button onClick={() => setShapeEditor(toShapeEditor(item))} className="rounded border border-zinc-300 px-2 py-1">Edit</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Weld catalog</div>
                        <div className="text-xs text-zinc-500">Apply to selected pieces or maintain your Tekla-style weld production table.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setWeldEditor(toWeldEditor())} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">New weld row</button>
                        <button onClick={() => void seedStarterWeldCatalog()} disabled={catalogSaving} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60">Load starter welds</button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input value={weldEditor.shopSetup} onChange={(e) => setWeldEditor((prev) => ({ ...prev, shopSetup: e.target.value }))} placeholder="Shop setup" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={weldEditor.weldType} onChange={(e) => setWeldEditor((prev) => ({ ...prev, weldType: e.target.value }))} placeholder="Weld type" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={weldEditor.weldProcess} onChange={(e) => setWeldEditor((prev) => ({ ...prev, weldProcess: e.target.value }))} placeholder="Process" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input value={weldEditor.thickness} onChange={(e) => setWeldEditor((prev) => ({ ...prev, thickness: e.target.value }))} placeholder="Thickness" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input type="number" step="0.01" value={weldEditor.ratePerHour} onChange={(e) => setWeldEditor((prev) => ({ ...prev, ratePerHour: Number(e.target.value) }))} placeholder="Rate/hr" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input type="number" step="0.01" value={weldEditor.weightPerFt} onChange={(e) => setWeldEditor((prev) => ({ ...prev, weightPerFt: Number(e.target.value) }))} placeholder="Weight/ft" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      <input type="number" step="0.01" value={weldEditor.costPerLb} onChange={(e) => setWeldEditor((prev) => ({ ...prev, costPerLb: Number(e.target.value) }))} placeholder="Cost/lb" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void saveWeldCatalogForm()} disabled={catalogSaving} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{weldEditor.id ? "Update weld row" : "Save weld row"}</button>
                      <button onClick={() => setWeldEditor(toWeldEditor())} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Clear</button>
                      {weldEditor.id ? <button onClick={() => void removeWeldCatalogRow(weldEditor.id)} disabled={catalogSaving} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60">Delete current</button> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select value={weldCatalogShopSetup} onChange={(e) => setWeldCatalogShopSetup(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">{weldShopSetups.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                      <select value={weldCatalogType} onChange={(e) => setWeldCatalogType(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">{weldTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                      <select value={weldCatalogProcess} onChange={(e) => setWeldCatalogProcess(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">{weldProcesses.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    </div>
                    <div className="mb-1 text-xs text-zinc-500">Select piece rows first, then Apply to stamp shop setup, weld type, process, and thickness onto those rows.</div>
                    <div className="max-h-[700px] overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500"><th className="px-2 py-2 text-left">Thickness</th><th className="px-2 py-2 text-right">Rate/hr</th><th className="px-2 py-2 text-right">Weight/ft</th><th className="px-2 py-2 text-right">Cost/lb</th><th className="px-2 py-2"></th></tr></thead>
                        <tbody>
                          {filteredWeldCatalog.map((row) => (
                            <tr key={row.id} className="border-b border-zinc-100">
                              <td className="px-2 py-2">{row.thickness}</td>
                              <td className="px-2 py-2 text-right">{decimal(row.ratePerHour, 2)}</td>
                              <td className="px-2 py-2 text-right">{decimal(row.weightPerFt, 2)}</td>
                              <td className="px-2 py-2 text-right">{money(row.costPerLb)}</td>
                              <td className="px-2 py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => applyWeldCatalog(row.thickness)} className="rounded border border-zinc-300 px-2 py-1">Apply</button>
                                  <button onClick={() => setWeldEditor(toWeldEditor(row))} className="rounded border border-zinc-300 px-2 py-1">Edit</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {!loadingEstimate && activeTab === "settings" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Labor rates and cost drivers</div>
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {[
                      ["Cut rate/hr", "cutRatePerHour"], ["Move rate/hr", "moveRatePerHour"], ["Layout rate/hr", "layoutRatePerHour"], ["Weld rate/hr", "weldRatePerHour"],
                      ["Material $/lb", "materialCostPerLb"], ["Drop %", "dropPct"], ["Weld material %", "weldMaterialPctOfSteel"], ["Weld material $/lb", "weldMaterialCostPerLb"],
                      ["Paint $/lb", "paintCostPerLb"], ["Overhead %", "shopOverheadPct"], ["Sales/Admin %", "salesAdminPct"], ["Profit %", "profitPct"], ["Field bolt $/ea", "fieldBoltCostEach"], ["Efficiency %", "efficiencyPct"],
                    ].map(([label, field]) => (
                      <label key={field} className="text-sm">
                        <div className="mb-1 text-zinc-500">{label}</div>
                        <input type="number" step="0.0001" value={n((settings as any)[field])} onChange={(e) => { setSettings((prev) => ({ ...prev, [field]: Number(e.target.value) })); setDirtySettings(true); }} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Labor codes</div>
                    <div className="overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="px-2 py-2 text-left">Code</th><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-right">Cut</th><th className="px-2 py-2 text-right">Move</th><th className="px-2 py-2 text-right">Layout</th><th className="px-2 py-2 text-right">Weld</th></tr></thead>
                        <tbody>
                          {settings.laborCodes.map((code, index) => (
                            <tr key={`${code.code}-${index}`} className="border-b border-zinc-100">
                              <td className="px-2 py-2"><input value={code.code} onChange={(e) => { const next=[...settings.laborCodes]; next[index]={...code, code:e.target.value}; setSettings((prev)=>({...prev,laborCodes:next})); setDirtySettings(true);} } className="w-20 rounded border border-zinc-300 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={code.description} onChange={(e) => { const next=[...settings.laborCodes]; next[index]={...code, description:e.target.value}; setSettings((prev)=>({...prev,laborCodes:next})); setDirtySettings(true);} } className="w-full rounded border border-zinc-300 px-2 py-1" /></td>
                              {(["cutMultiplier","moveMultiplier","layoutMultiplier","weldMultiplier"] as const).map((field) => <td key={field} className="px-2 py-2"><input type="number" step="0.01" value={n(code[field])} onChange={(e)=>{ const next=[...settings.laborCodes]; next[index]={...code,[field]:Number(e.target.value)}; setSettings((prev)=>({...prev,laborCodes:next})); setDirtySettings(true);} } className="w-16 rounded border border-zinc-300 px-2 py-1 text-right" /></td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Weld thresholds</div>
                    <div className="overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="border-b border-zinc-200 text-zinc-500"><th className="px-2 py-2 text-left">Max lbs/ft</th><th className="px-2 py-2 text-left">Weld size</th><th className="px-2 py-2 text-right">Factor</th></tr></thead>
                        <tbody>
                          {settings.weldThresholds.map((row, index) => (
                            <tr key={index} className="border-b border-zinc-100">
                              <td className="px-2 py-2"><input type="number" step="0.01" value={n(row.maxLbsPerFoot)} onChange={(e)=>{ const next=[...settings.weldThresholds]; next[index]={...row,maxLbsPerFoot:Number(e.target.value)}; setSettings((prev)=>({...prev,weldThresholds:next})); setDirtySettings(true);} } className="w-24 rounded border border-zinc-300 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input value={row.weldSize} onChange={(e)=>{ const next=[...settings.weldThresholds]; next[index]={...row,weldSize:e.target.value}; setSettings((prev)=>({...prev,weldThresholds:next})); setDirtySettings(true);} } className="w-24 rounded border border-zinc-300 px-2 py-1" /></td>
                              <td className="px-2 py-2"><input type="number" step="0.01" value={n(row.factor)} onChange={(e)=>{ const next=[...settings.weldThresholds]; next[index]={...row,factor:Number(e.target.value)}; setSettings((prev)=>({...prev,weldThresholds:next})); setDirtySettings(true);} } className="w-20 rounded border border-zinc-300 px-2 py-1 text-right" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
