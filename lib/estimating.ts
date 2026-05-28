import { findWeldCatalogRow } from "@/lib/weld-catalog";
export type WeldThreshold = {
  maxLbsPerFoot: number;
  weldSize: string;
  weldCatalogRatePerHour: number | null;
  weldCatalogWeightPerFt: number | null;
  weldCatalogCostPerLb: number | null;
  factor: number;
};

export type LaborCode = {
  code: string;
  description: string;
  cutMultiplier: number;
  moveMultiplier: number;
  layoutMultiplier: number;
  weldMultiplier: number;
  notes?: string;
};

export type EstimateSettings = {
  shopRatePerHour: number;
  cutRatePerHour: number;
  moveRatePerHour: number;
  layoutRatePerHour: number;
  weldRatePerHour: number;
  cutHoursPerLb: number;
  cutHoursPerFt: number;
  cutHoursPerPiece: number;
  moveHoursPerLb: number;
  moveHoursPerFt: number;
  moveHoursPerPiece: number;
  layoutHoursPerLb: number;
  layoutHoursPerFt: number;
  layoutHoursPerPiece: number;
  weldHoursPerLb: number;
  weldHoursPerFt: number;
  weldHoursPerPiece: number;
  efficiencyPct: number;
  materialCostPerLb: number;
  dropPct: number;
  weldMaterialPctOfSteel: number;
  weldMaterialCostPerLb: number;
  paintCostPerLb: number;
  shopOverheadPct: number;
  salesAdminPct: number;
  profitPct: number;
  freightRatePerMile: number;
  fieldBoltCostEach: number;
  weldThresholds: WeldThreshold[];
  laborCodes: LaborCode[];
};

export type EstimateJobInfo = {
  estimator: string;
  estimateDate: string;
  estimateNumber: string;
  estimateName: string;
  location: string;
  county: string;
  groupName: string;
  groupName2: string;
  recipientCompany: string;
  recipientContact: string;
  phone: string;
  fax: string;
  erectorEstimateNumber: string;
  taxExempt: string;
  distanceToJobMiles: number;
  siteCompletion: string;
  liquidatedDamages: string;
  detailingCost: number;
  buyoutCost: number;
  inboundFreightCost: number;
  jobsiteFreightCost: number;
  erectionCost: number;
  fieldBoltsEach: number;
  notes: string;
};

export type EstimatePiece = {
  shopSetup: string;
  weldType: string;
  weldProcess: string;
  weldThickness: string;
  id: string;
  page: number;
  item: number;
  partNumber: string;
  quantity: number;
  isMainPiece: boolean;
  mainPieceId: string;
  shape: string;
  description: string;
  dimension: string;
  lengthFeet: number;
  lengthInches: number;
  grade: string;
  type: string;
  extraCode: string;
  category: string;
  subCategory: string;
  finish: string;
  paintSystem: string;
  sequence: string;
  notes: string;
  manualWeightLbs: number | null;
  additionalHoles: number | null;
  manualWeldLinearFeet: number | null;
  manualCutHours: number | null;
  manualMoveHours: number | null;
  manualLayoutHours: number | null;
  manualWeldHours: number | null;
  addCutHours: number | null;
  addMoveHours: number | null;
  addLayoutHours: number | null;
  addWeldHours: number | null;
  manualCostPerItem: number | null;
};

export type JobEstimate = {
  jobId: string;
  jobNumber: string;
  jobName: string;
  clientName: string;
  info: EstimateJobInfo;
  pieces: EstimatePiece[];
};

export type EstimatingStore = {
  settings: EstimateSettings;
  estimatesByJobId: Record<string, JobEstimate>;
};

export const STORAGE_KEY = "stakd-estimating-v1";

export const defaultLaborCodes: LaborCode[] = [
  { code: "A", description: "Plain material", cutMultiplier: 1, moveMultiplier: 1, layoutMultiplier: 0.6, weldMultiplier: 0 },
  { code: "B", description: "Bolted clips both ends", cutMultiplier: 1.1, moveMultiplier: 1.05, layoutMultiplier: 1.2, weldMultiplier: 0.4 },
  { code: "BB", description: "Full-penetration prep and bolted clips both ends", cutMultiplier: 1.2, moveMultiplier: 1.05, layoutMultiplier: 1.4, weldMultiplier: 1.1 },
  { code: "BB-1", description: "Full-penetration prep one end and bolted clips both ends", cutMultiplier: 1.15, moveMultiplier: 1.05, layoutMultiplier: 1.3, weldMultiplier: 0.95 },
  { code: "C", description: "Bolted clip on one end", cutMultiplier: 1.05, moveMultiplier: 1.02, layoutMultiplier: 1, weldMultiplier: 0.25 },
  { code: "F", description: "Punched both ends", cutMultiplier: 1.08, moveMultiplier: 1, layoutMultiplier: 0.9, weldMultiplier: 0 },
  { code: "G", description: "Punched one end", cutMultiplier: 1.04, moveMultiplier: 1, layoutMultiplier: 0.8, weldMultiplier: 0 },
  { code: "H", description: "Welded base both ends", cutMultiplier: 1.05, moveMultiplier: 1.03, layoutMultiplier: 1.15, weldMultiplier: 1.2 },
  { code: "I", description: "Welded base one end", cutMultiplier: 1.03, moveMultiplier: 1.02, layoutMultiplier: 1.05, weldMultiplier: 0.75 },
  { code: "J", description: "Stitch welds along length of item", cutMultiplier: 1, moveMultiplier: 1.02, layoutMultiplier: 1.25, weldMultiplier: 1.3 },
  { code: "K", description: "Full-penetration preparation both ends", cutMultiplier: 1.15, moveMultiplier: 1.02, layoutMultiplier: 1.2, weldMultiplier: 1.5 },
  { code: "L", description: "Full-penetration preparation one end", cutMultiplier: 1.08, moveMultiplier: 1.02, layoutMultiplier: 1.1, weldMultiplier: 1.15 },
  { code: "M", description: "Full-penetration preparation and weld both ends", cutMultiplier: 1.18, moveMultiplier: 1.05, layoutMultiplier: 1.25, weldMultiplier: 1.65 },
  { code: "N", description: "Full-penetration preparation and weld one end", cutMultiplier: 1.12, moveMultiplier: 1.03, layoutMultiplier: 1.15, weldMultiplier: 1.35 },
  { code: "N-1", description: "Full-penetration prep and weld one end, standard weld one end", cutMultiplier: 1.1, moveMultiplier: 1.03, layoutMultiplier: 1.15, weldMultiplier: 1.25 },
  { code: "FH", description: "Frame welds on both ends", cutMultiplier: 1.05, moveMultiplier: 1.04, layoutMultiplier: 1.2, weldMultiplier: 1.1 },
  { code: "T", description: "Knife plate through both sides of HSS column", cutMultiplier: 1.12, moveMultiplier: 1.08, layoutMultiplier: 1.4, weldMultiplier: 1.35 },
  { code: "U", description: "Knife plate through one side of HSS column", cutMultiplier: 1.08, moveMultiplier: 1.05, layoutMultiplier: 1.25, weldMultiplier: 1.15 },
  { code: "X", description: "Lay flat and weld around perimeter", cutMultiplier: 1.06, moveMultiplier: 1.04, layoutMultiplier: 1.2, weldMultiplier: 1.45 },
];

export const defaultSettings: EstimateSettings = {
  shopRatePerHour: 29,
  cutRatePerHour: 29,
  moveRatePerHour: 29,
  layoutRatePerHour: 29,
  weldRatePerHour: 29,
  cutHoursPerLb: 0.00005,
  cutHoursPerFt: 0.0025,
  cutHoursPerPiece: 0.05,
  moveHoursPerLb: 0.00003,
  moveHoursPerFt: 0.0015,
  moveHoursPerPiece: 0.04,
  layoutHoursPerLb: 0.000045,
  layoutHoursPerFt: 0.002,
  layoutHoursPerPiece: 0.08,
  weldHoursPerLb: 0.00002,
  weldHoursPerFt: 0.008,
  weldHoursPerPiece: 0.06,
  efficiencyPct: 75,
  materialCostPerLb: 0.917,
  dropPct: 7.5,
  weldMaterialPctOfSteel: 0.226,
  weldMaterialCostPerLb: 0.91,
  paintCostPerLb: 0.0116,
  shopOverheadPct: 125,
  salesAdminPct: 23.465,
  profitPct: 10,
  freightRatePerMile: 0,
  fieldBoltCostEach: 1.25,
  weldThresholds: [
    {
      maxLbsPerFoot: 15,
      weldSize: '3/16"',
      weldCatalogRatePerHour: null,
      weldCatalogWeightPerFt: null,
      weldCatalogCostPerLb: null,
      factor: 1,
    },
    {
      maxLbsPerFoot: 40,
      weldSize: '1/4"',
      weldCatalogRatePerHour: null,
      weldCatalogWeightPerFt: null,
      weldCatalogCostPerLb: null,
      factor: 1.2,
    },
    {
      maxLbsPerFoot: 80,
      weldSize: '5/16"',
      weldCatalogRatePerHour: null,
      weldCatalogWeightPerFt: null,
      weldCatalogCostPerLb: null,
      factor: 1.45,
    },
    {
      maxLbsPerFoot: 9999,
      weldSize: '3/8"',
      weldCatalogRatePerHour: null,
      weldCatalogWeightPerFt: null,
      weldCatalogCostPerLb: null,
      factor: 1.7,
    },
  ],
  laborCodes: defaultLaborCodes,
};

export function defaultJobInfo(jobNumber: string, jobName: string): EstimateJobInfo {
  return {
    estimator: "",
    estimateDate: new Date().toISOString().slice(0, 10),
    estimateNumber: jobNumber,
    estimateName: jobName,
    location: "",
    county: "",
    groupName: "",
    groupName2: "",
    recipientCompany: "",
    recipientContact: "",
    phone: "",
    fax: "",
    erectorEstimateNumber: "",
    taxExempt: "",
    distanceToJobMiles: 0,
    siteCompletion: "",
    liquidatedDamages: "",
    detailingCost: 0,
    buyoutCost: 0,
    inboundFreightCost: 0,
    jobsiteFreightCost: 0,
    erectionCost: 0,
    fieldBoltsEach: 0,
    notes: "",
  };
}

export function blankPiece(nextIndex = 1): EstimatePiece {
  return {
    id: `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    page: 1,
    item: nextIndex * 10,
    partNumber: "",
    quantity: 1,
    shopSetup: "2024.1",
    weldType: "Fillet Weld",
    weldProcess: "Semi-Automatic",
    weldThickness: "",
    isMainPiece: false,
    mainPieceId: "",
    shape: "",
    description: "",
    dimension: "",
    lengthFeet: 0,
    lengthInches: 0,
    grade: "A992",
    type: "",
    extraCode: "A",
    category: "",
    subCategory: "",
    finish: "Painted",
    paintSystem: "All",
    sequence: "",
    notes: "",
    manualWeightLbs: null,
    additionalHoles: null,
    manualWeldLinearFeet: null,
    manualCutHours: null,
    manualMoveHours: null,
    manualLayoutHours: null,
    manualWeldHours: null,
    addCutHours: null,
    addMoveHours: null,
    addLayoutHours: null,
    addWeldHours: null,
    manualCostPerItem: null,
  };
}

export function ensureEstimate(partial: Partial<JobEstimate>, jobId: string, jobNumber: string, jobName: string, clientName = ""): JobEstimate {
  return {
    jobId,
    jobNumber,
    jobName,
    clientName,
    info: { ...defaultJobInfo(jobNumber, jobName), ...(partial.info ?? {}) },
    pieces: Array.isArray(partial.pieces) ? partial.pieces.map((piece, index) => ({ ...blankPiece(index + 1), ...piece })) : [],
  };
}

export function createDefaultStore(): EstimatingStore {
  return {
    settings: structuredClone(defaultSettings),
    estimatesByJobId: {},
  };
}

export function parseStore(raw: string | null): EstimatingStore {
  if (!raw) return createDefaultStore();
  try {
    const parsed = JSON.parse(raw) as Partial<EstimatingStore>;
    return {
      settings: {
        ...defaultSettings,
        ...(parsed.settings ?? {}),
        laborCodes: Array.isArray(parsed.settings?.laborCodes) && parsed.settings!.laborCodes.length
          ? parsed.settings!.laborCodes
          : structuredClone(defaultLaborCodes),
        weldThresholds: Array.isArray(parsed.settings?.weldThresholds) && parsed.settings!.weldThresholds.length
          ? parsed.settings!.weldThresholds
          : structuredClone(defaultSettings.weldThresholds),
      },
      estimatesByJobId: parsed.estimatesByJobId ?? {},
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveStore(store: EstimatingStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function loadStore(): EstimatingStore {
  if (typeof window === "undefined") return createDefaultStore();
  return parseStore(window.localStorage.getItem(STORAGE_KEY));
}

export function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round((value + Number.EPSILON) * p) / p;
}

export function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function decimal(value: number, digits = 2) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0);
}

export function percent(value: number, digits = 1) {
  return `${decimal(value, digits)}%`;
}

const STEEL_LB_PER_CUBIC_INCH = 0.2836;
const LB_PER_FT_PER_SQ_IN = STEEL_LB_PER_CUBIC_INCH * 12;

const KNOWN_LBS_PER_FT: Record<string, number> = {
  "W8X10": 10,
  "W8X13": 13,
  "W8X18": 18,
  "W8X21": 21,
  "W10X12": 12,
  "W10X15": 15,
  "W10X19": 19,
  "W10X22": 22,
  "W10X26": 26,
  "W10X33": 33,
  "W12X14": 14,
  "W12X19": 19,
  "W12X22": 22,
  "W12X26": 26,
  "W12X35": 35,
  "W12X40": 40,
  "W12X50": 50,
  "W14X22": 22,
  "W14X26": 26,
  "W14X30": 30,
  "W14X38": 38,
  "W14X48": 48,
  "W14X61": 61,
  "W14X90": 90,
  "W16X26": 26,
  "W16X31": 31,
  "W16X36": 36,
  "W16X40": 40,
  "W16X50": 50,
  "W16X57": 57,
  "W16X67": 67,
  "W18X35": 35,
  "W18X40": 40,
  "W18X46": 46,
  "W18X50": 50,
  "W18X60": 60,
  "W18X71": 71,
  "W21X44": 44,
  "W21X50": 50,
  "W21X57": 57,
  "W21X68": 68,
  "W21X83": 83,
  "W21X93": 93,
  "W24X55": 55,
  "W24X62": 62,
  "W24X76": 76,
  "W24X84": 84,
  "W24X103": 103,
  "W27X84": 84,
  "W27X94": 94,
  "W27X102": 102,
  "W27X114": 114,
  "W30X90": 90,
  "W30X99": 99,
  "W30X108": 108,
  "W30X116": 116,
  "C6X8.2": 8.2,
  "C8X11.5": 11.5,
  "C9X13.4": 13.4,
  "C10X15.3": 15.3,
  "C12X20.7": 20.7,
  "C15X33.9": 33.9,
  "MC8X8.5": 8.5,
  "MC10X22": 22,
  "MC12X14.3": 14.3,
  "MC18X58": 58,
  "L2X2X1/4": 3.19,
  "L3X3X1/4": 5.72,
  "L3X3X3/8": 8.41,
  "L4X4X1/4": 7.58,
  "L4X4X3/8": 11.1,
  "L5X3-1/2X3/8": 12.2,
  "L6X4X1/2": 19.1,
  "L6X6X1/2": 28.2,
  "HSS2X2X1/4": 5.79,
  "HSS3X3X1/4": 8.91,
  "HSS4X4X1/4": 12.2,
  "HSS4X4X3/8": 17.7,
  "HSS6X6X1/4": 18.7,
  "HSS8X8X3/8": 39.3,
  "HSS4X2X1/4": 8.07,
  "HSS6X4X1/4": 13.4,
  "HSS8X4X1/4": 17.1,
  "HSS8X6X3/8": 28.6,
  "HSS10X6X1/2": 38.8,
  "PIPE2STD": 3.66,
  "PIPE3STD": 7.58,
  "PIPE4STD": 10.79,
  "PIPE6STD": 18.97,
  "PIPE8STD": 28.55,
  "PL1/4": 10.21,
  "PL3/8": 15.32,
  "PL1/2": 20.43,
  "PL3/4": 30.64,
  "PL1": 40.86,
  "FB2X1/4": 1.7,
  "FB3X3/8": 3.83,
  "FB4X1/2": 6.81,
  "FB6X1/2": 10.21,
  "RB1": 2.67,
  "RB1-1/2": 6.01,
  "RB2": 10.68,
};

function normalizeShapeKey(shape: string) {
  return (shape || "").toUpperCase().replace(/["'\s]/g, "");
}

function parseFractionalInches(value: string | undefined) {
  if (!value) return 0;
  const cleaned = value.trim().replace(/"/g, "");
  const mixed = cleaned.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixed) return n(mixed[1]) + n(mixed[2]) / Math.max(1, n(mixed[3], 1));
  const frac = cleaned.match(/^(\d+)\/(\d+)$/);
  if (frac) return n(frac[1]) / Math.max(1, n(frac[2], 1));
  return n(cleaned);
}

export function lbsPerFootFromShape(shape: string): number | null {
  const raw = normalizeShapeKey(shape);
  if (!raw) return null;
  if (KNOWN_LBS_PER_FT[raw]) return KNOWN_LBS_PER_FT[raw];

  const beamLike = raw.match(/^(W|C|MC)\d+(?:\.\d+)?X(\d+(?:\.\d+)?)$/);
  if (beamLike) return n(beamLike[2], 0) || null;

  const plate = raw.match(/^PL([\d\-/\.]+)(?:X([\d\-/\.]+))?$/);
  if (plate) {
    const thickness = parseFractionalInches(plate[1]);
    const width = parseFractionalInches(plate[2] || "12");
    const weight = thickness * width * LB_PER_FT_PER_SQ_IN;
    return weight > 0 ? round(weight, 2) : null;
  }

  const flatBar = raw.match(/^FB([\d\-/\.]+)X([\d\-/\.]+)$/);
  if (flatBar) {
    const width = parseFractionalInches(flatBar[1]);
    const thickness = parseFractionalInches(flatBar[2]);
    const weight = width * thickness * LB_PER_FT_PER_SQ_IN;
    return weight > 0 ? round(weight, 2) : null;
  }

  const roundBar = raw.match(/^RB([\d\-/\.]+)$/);
  if (roundBar) {
    const diameter = parseFractionalInches(roundBar[1]);
    const area = Math.PI * Math.pow(diameter / 2, 2);
    const weight = area * LB_PER_FT_PER_SQ_IN;
    return weight > 0 ? round(weight, 2) : null;
  }

  const angle = raw.match(/^L([\d\-/\.]+)X([\d\-/\.]+)X([\d\-/\.]+)$/);
  if (angle) {
    const leg1 = parseFractionalInches(angle[1]);
    const leg2 = parseFractionalInches(angle[2]);
    const thickness = parseFractionalInches(angle[3]);
    const area = Math.max(0, leg1 + leg2 - thickness) * thickness;
    const weight = area * LB_PER_FT_PER_SQ_IN;
    return weight > 0 ? round(weight, 2) : null;
  }

  const hss = raw.match(/^HSS([\d\-/\.]+)X([\d\-/\.]+)X([\d\-/\.]+)$/);
  if (hss) {
    const side1 = parseFractionalInches(hss[1]);
    const side2 = parseFractionalInches(hss[2]);
    const wall = parseFractionalInches(hss[3]);
    const area = Math.max(0, 2 * side1 + 2 * side2 - 4 * wall) * wall;
    const weight = area * LB_PER_FT_PER_SQ_IN;
    return weight > 0 ? round(weight, 2) : null;
  }

  return null;
}

export function lengthFeet(piece: EstimatePiece) {
  return n(piece.lengthFeet) + n(piece.lengthInches) / 12;
}

export function totalLengthFeet(piece: EstimatePiece) {
  return lengthFeet(piece) * Math.max(1, n(piece.quantity, 1));
}

export function weldForShape(shape: string, settings: EstimateSettings) {
  const wpf = lbsPerFootFromShape(shape) ?? 0;
  const threshold = settings.weldThresholds.find((row) => wpf <= n(row.maxLbsPerFoot, 9999)) ?? settings.weldThresholds.at(-1)!;
  return threshold;
}

export type PieceCalc = {
  cutRate: number;
  moveRate: number;
  layoutRate: number;
  weldRate: number;
  quantityPerMain: number;
  mainMultiplier: number;
  effectiveQuantity: number;
  lengthFeet: number;
  totalLengthFeet: number;
  weightPerPiece: number;
  totalWeight: number;
  weldSize: string;
  weldCatalogRatePerHour: number | null;
  weldCatalogWeightPerFt: number | null;
  weldCatalogCostPerLb: number | null;
  cutHours: number;
  moveHours: number;
  layoutHours: number;
  weldHours: number;
  totalHours: number;
  laborCost: number;
  materialCost: number;
  lineTotal: number;
};


function buildPieceMap(pieces?: EstimatePiece[]) {
  return new Map((pieces ?? []).map((piece) => [piece.id, piece]));
}

function getMainMultiplier(piece: EstimatePiece, piecesById: Map<string, EstimatePiece>, seen = new Set<string>()): number {
  if (!piece.mainPieceId) return 1;
  if (seen.has(piece.id)) return 1;
  const parent = piecesById.get(piece.mainPieceId);
  if (!parent) return 1;
  seen.add(piece.id);
  return Math.max(1, n(parent.quantity, 1)) * getMainMultiplier(parent, piecesById, seen);
}

export function calcPiece(piece: EstimatePiece, settings: EstimateSettings, pieces?: EstimatePiece[]): PieceCalc {
  const piecesById = buildPieceMap(pieces);
  const qtyPerMain = Math.max(1, n(piece.quantity, 1));
  const mainMultiplier = getMainMultiplier(piece, piecesById);
  const qty = qtyPerMain * mainMultiplier;
  const lenFt = Math.max(0, lengthFeet(piece));
  const totalLenFt = lenFt * qty;
  const lbsPerFt = lbsPerFootFromShape(piece.shape) ?? 0;
  const weightPerPiece = Math.max(0, piece.manualWeightLbs ?? (lbsPerFt ? lbsPerFt * lenFt : 0));
  const totalWeight = weightPerPiece * qty;
  const code = settings.laborCodes.find((row) => row.code === piece.extraCode) ?? defaultLaborCodes[0];
  const weldRule = weldForShape(piece.shape, settings);
  const weldCatalogRow = findWeldCatalogRow({
    shopSetup: piece.shopSetup || "2024.1",
    weldType: piece.weldType || undefined,
    weldProcess: piece.weldProcess || undefined,
    thickness: piece.weldThickness || undefined,
  });

  const efficiencyDivisor = Math.max(0.01, n(settings.efficiencyPct, 75) / 100);

  const rawCut = (settings.cutHoursPerPiece * qty + settings.cutHoursPerFt * totalLenFt + settings.cutHoursPerLb * totalWeight) * n(code.cutMultiplier, 1);
  const rawMove = (settings.moveHoursPerPiece * qty + settings.moveHoursPerFt * totalLenFt + settings.moveHoursPerLb * totalWeight) * n(code.moveMultiplier, 1);
  const rawLayout = (settings.layoutHoursPerPiece * qty + settings.layoutHoursPerFt * totalLenFt + settings.layoutHoursPerLb * totalWeight) * n(code.layoutMultiplier, 1);
  const rawWeld = weldCatalogRow
    ? (totalLenFt / Math.max(0.01, weldCatalogRow.ratePerHour)) * n(code.weldMultiplier, 1) / efficiencyDivisor
    : (settings.weldHoursPerPiece * qty + settings.weldHoursPerFt * totalLenFt + settings.weldHoursPerLb * totalWeight) * n(code.weldMultiplier, 1) * n(weldRule.factor, 1);

  const additionalHoleHours = (n(piece.additionalHoles) * 0.025 * qty) / efficiencyDivisor;
  const manualWeldFeetTotal = Math.max(0, n(piece.manualWeldLinearFeet)) * qty;
  const manualWeldFeetHours = weldCatalogRow
    ? manualWeldFeetTotal / Math.max(0.01, weldCatalogRow.ratePerHour)
    : (manualWeldFeetTotal * settings.weldHoursPerFt) / efficiencyDivisor;

  const cutHours = (piece.manualCutHours ?? rawCut / efficiencyDivisor) + n(piece.addCutHours) + additionalHoleHours;
  const moveHours = (piece.manualMoveHours ?? rawMove / efficiencyDivisor) + n(piece.addMoveHours);
  const layoutHours = (piece.manualLayoutHours ?? rawLayout / efficiencyDivisor) + n(piece.addLayoutHours);
  const weldHours = (piece.manualWeldHours ?? (weldCatalogRow ? rawWeld : rawWeld / efficiencyDivisor)) + n(piece.addWeldHours) + manualWeldFeetHours;
  const totalHours = cutHours + moveHours + layoutHours + weldHours;
  const cutRate = n(settings.cutRatePerHour, n(settings.shopRatePerHour, 0));
  const moveRate = n(settings.moveRatePerHour, n(settings.shopRatePerHour, 0));
  const layoutRate = n(settings.layoutRatePerHour, n(settings.shopRatePerHour, 0));
  const weldRate = n(settings.weldRatePerHour, n(settings.shopRatePerHour, 0));
  const laborCost = cutHours * cutRate + moveHours * moveRate + layoutHours * layoutRate + weldHours * weldRate;
  const materialCost = totalWeight * n(settings.materialCostPerLb, 0);
  const lineTotal = piece.manualCostPerItem != null ? n(piece.manualCostPerItem) * qty : laborCost + materialCost;

  return {
    cutRate: round(cutRate, 2),
    moveRate: round(moveRate, 2),
    layoutRate: round(layoutRate, 2),
    weldRate: round(weldRate, 2),
    quantityPerMain: round(qtyPerMain, 2),
    mainMultiplier: round(mainMultiplier, 2),
    effectiveQuantity: round(qty, 2),
    lengthFeet: round(lenFt, 2),
    totalLengthFeet: round(totalLenFt, 2),
    weightPerPiece: round(weightPerPiece, 2),
    totalWeight: round(totalWeight, 2),
    weldSize: weldCatalogRow?.thickness ?? weldRule.weldSize,
    weldCatalogRatePerHour: weldCatalogRow?.ratePerHour ?? null,
    weldCatalogWeightPerFt: weldCatalogRow?.weightPerFt ?? null,
    weldCatalogCostPerLb: weldCatalogRow?.costPerLb ?? null,
    cutHours: round(cutHours, 2),
    moveHours: round(moveHours, 2),
    layoutHours: round(layoutHours, 2),
    weldHours: round(weldHours, 2),
    totalHours: round(totalHours, 2),
    laborCost: round(laborCost, 2),
    materialCost: round(materialCost, 2),
    lineTotal: round(lineTotal, 2),
  };
}

export type EstimateSummary = {
  pieceCount: number;
  totalWeight: number;
  totalTons: number;
  materialCost: number;
  dropWeight: number;
  dropCost: number;
  weldMaterialWeight: number;
  weldMaterialCost: number;
  paintCost: number;
  fieldBoltsCost: number;
  laborHours: { cut: number; move: number; layout: number; weld: number; total: number };
  laborCost: number;
  overheadCost: number;
  detailingCost: number;
  buyoutCost: number;
  inboundFreightCost: number;
  jobsiteFreightCost: number;
  erectionCost: number;
  subtotalBeforeSales: number;
  salesAdminCost: number;
  profitCost: number;
  grandTotal: number;
  costPerTon: number;
};

export function summarizeEstimate(estimate: JobEstimate, settings: EstimateSettings): EstimateSummary {
  const calcs = estimate.pieces.map((piece) => calcPiece(piece, settings, estimate.pieces));
  const totalWeight = calcs.reduce((sum, row) => sum + row.totalWeight, 0);
  const materialCost = calcs.reduce((sum, row) => sum + row.materialCost, 0);
  const cut = calcs.reduce((sum, row) => sum + row.cutHours, 0);
  const move = calcs.reduce((sum, row) => sum + row.moveHours, 0);
  const layout = calcs.reduce((sum, row) => sum + row.layoutHours, 0);
  const weld = calcs.reduce((sum, row) => sum + row.weldHours, 0);
  const laborCost = calcs.reduce((sum, row) => sum + row.laborCost, 0);

  const dropWeight = totalWeight * (n(settings.dropPct) / 100);
  const dropCost = materialCost * (n(settings.dropPct) / 100);
  const weldMaterialWeight = totalWeight * (n(settings.weldMaterialPctOfSteel) / 100);
  const weldMaterialCost = weldMaterialWeight * n(settings.weldMaterialCostPerLb);
  const paintedWeight = estimate.pieces
    .filter((piece) => (piece.finish || "").toLowerCase() !== "unpainted")
    .reduce((sum, piece) => sum + calcPiece(piece, settings, estimate.pieces).totalWeight, 0);
  const paintCost = paintedWeight * n(settings.paintCostPerLb);
  const fieldBoltsCost = n(estimate.info.fieldBoltsEach) * n(settings.fieldBoltCostEach);
  const overheadCost = laborCost * (n(settings.shopOverheadPct) / 100);
  const subtotalBeforeSales = materialCost + dropCost + weldMaterialCost + paintCost + fieldBoltsCost + laborCost + overheadCost + n(estimate.info.detailingCost) + n(estimate.info.buyoutCost) + n(estimate.info.inboundFreightCost) + n(estimate.info.jobsiteFreightCost) + n(estimate.info.erectionCost);
  const salesAdminCost = subtotalBeforeSales * (n(settings.salesAdminPct) / 100);
  const profitCost = (subtotalBeforeSales + salesAdminCost) * (n(settings.profitPct) / 100);
  const grandTotal = subtotalBeforeSales + salesAdminCost + profitCost;

  return {
    pieceCount: estimate.pieces.length,
    totalWeight: round(totalWeight, 2),
    totalTons: round(totalWeight / 2000, 2),
    materialCost: round(materialCost, 2),
    dropWeight: round(dropWeight, 2),
    dropCost: round(dropCost, 2),
    weldMaterialWeight: round(weldMaterialWeight, 2),
    weldMaterialCost: round(weldMaterialCost, 2),
    paintCost: round(paintCost, 2),
    fieldBoltsCost: round(fieldBoltsCost, 2),
    laborHours: {
      cut: round(cut, 2),
      move: round(move, 2),
      layout: round(layout, 2),
      weld: round(weld, 2),
      total: round(cut + move + layout + weld, 2),
    },
    laborCost: round(laborCost, 2),
    overheadCost: round(overheadCost, 2),
    detailingCost: round(n(estimate.info.detailingCost), 2),
    buyoutCost: round(n(estimate.info.buyoutCost), 2),
    inboundFreightCost: round(n(estimate.info.inboundFreightCost), 2),
    jobsiteFreightCost: round(n(estimate.info.jobsiteFreightCost) || n(estimate.info.distanceToJobMiles) * n(settings.freightRatePerMile), 2),
    erectionCost: round(n(estimate.info.erectionCost), 2),
    subtotalBeforeSales: round(subtotalBeforeSales, 2),
    salesAdminCost: round(salesAdminCost, 2),
    profitCost: round(profitCost, 2),
    grandTotal: round(grandTotal, 2),
    costPerTon: round(totalWeight ? grandTotal / (totalWeight / 2000) : 0, 2),
  };
}

export function buildSummaryRows(estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  return [
    ["", "Estimate Summary", "", "", "", "Estimate Date:", "", estimate.info.estimateDate, "", "Estimate #:", "", estimate.info.estimateNumber],
    ["", "Recipient Information"],
    ["", "Company:", "", "", "", estimate.info.recipientCompany, "", "", "", "Phone:", "", estimate.info.phone],
    ["", "Contact:", "", "", "", estimate.info.recipientContact, "", "", "", "Fax:", "", estimate.info.fax],
    ["", "Estimate Job Site Information"],
    ["", "Estimate Name:", "", "", "", estimate.info.estimateName, "", "", "", "Erector Estimate #:", "", estimate.info.erectorEstimateNumber],
    ["", "Location:", "", "", "", estimate.info.location, "", "", "", "Tax Exempt:", "", estimate.info.taxExempt],
    ["", "County:", "", "", "", estimate.info.county, "", "", "", "Dist. From Shop:", "", summary.jobsiteFreightCost ? estimate.info.distanceToJobMiles : estimate.info.distanceToJobMiles],
    ["", "Group Name:", "", "", "", estimate.info.groupName, "", "", "", "Site Completion:", "", estimate.info.siteCompletion],
    ["", "Group Name 2:", "", "", "", estimate.info.groupName2, "", "", "", "Liq. Damages:", "", estimate.info.liquidatedDamages],
    ["", "« MATERIALS »", "Item", "", "Qty/Weight", "Cost", "O.H. %", "O.H.", "S,G&A %", "S,G&A", "Profit %", "Profit"],
    ["", "", "Fabricated Materials:", "", summary.totalWeight, summary.materialCost, 0, 0, n(settings.salesAdminPct) / 100, summary.salesAdminCost, n(settings.profitPct) / 100, summary.profitCost],
    ["", "", "Drop", `(${settings.dropPct}%):`, summary.dropWeight, summary.dropCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Weld Material:", "", summary.weldMaterialWeight, summary.weldMaterialCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Field Bolts:", "", estimate.info.fieldBoltsEach, summary.fieldBoltsCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Buyouts:", "", "", summary.buyoutCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Inbound Freight:", "", "", summary.inboundFreightCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Paint / Coating:", "", "", summary.paintCost, 0, 0, 0, 0, 0, 0],
    ["", "", "MATERIAL TOTAL:", "", summary.totalWeight, summary.materialCost + summary.dropCost + summary.weldMaterialCost + summary.fieldBoltsCost + summary.buyoutCost + summary.inboundFreightCost + summary.paintCost, 0, 0, 0, 0, 0, 0],
    ["", "« LABOR »", "Item", "Rate", "Hours", "Cost", "O.H. %", "O.H.", "S,G&A %", "S,G&A", "Profit %", "Profit"],
    ["", "", "Cut", settings.cutRatePerHour, summary.laborHours.cut, round(summary.laborHours.cut * settings.cutRatePerHour, 2), 0, 0, 0, 0, 0, 0],
    ["", "", "Move", settings.moveRatePerHour, summary.laborHours.move, round(summary.laborHours.move * settings.moveRatePerHour, 2), 0, 0, 0, 0, 0, 0],
    ["", "", "Layout", settings.layoutRatePerHour, summary.laborHours.layout, round(summary.laborHours.layout * settings.layoutRatePerHour, 2), 0, 0, 0, 0, 0, 0],
    ["", "", "Weld", settings.weldRatePerHour, summary.laborHours.weld, round(summary.laborHours.weld * settings.weldRatePerHour, 2), 0, 0, 0, 0, 0, 0],
    ["", "", "Labor Subtotal:", "", summary.laborHours.total, summary.laborCost, n(settings.shopOverheadPct) / 100, summary.overheadCost, 0, 0, 0, 0],
    ["", "", "LABOR TOTAL:", "", summary.laborHours.total, summary.laborCost + summary.overheadCost, 0, 0, 0, 0, 0, 0],
    ["", "« SUBCONTRACTS »", "Item", "", "Qty/Weight", "Cost", "O.H. %", "O.H.", "S,G&A %", "S,G&A", "Profit %", "Profit"],
    ["", "", "Detailing:", "", "", summary.detailingCost, 0, 0, 0, 0, 0, 0],
    ["", "", "Sub-out Total:", "", "", summary.buyoutCost + summary.detailingCost, 0, 0, 0, 0, 0, 0],
    ["", "Supply Only Total:", "", "", "", summary.subtotalBeforeSales - summary.jobsiteFreightCost - summary.erectionCost, "", summary.overheadCost, "", summary.salesAdminCost, "", summary.profitCost],
    ["", "Jobsite Freight:", "", "", estimate.info.distanceToJobMiles, summary.jobsiteFreightCost, 0, 0, 0, 0, 0, 0],
    ["", "JOB SITE TOTAL:", "", "", "", summary.jobsiteFreightCost + summary.erectionCost, 0, 0, 0, 0, 0, 0],
    ["", "GRAND TOTAL:", "", "", summary.totalWeight, summary.grandTotal, "", summary.overheadCost, "", summary.salesAdminCost, "", summary.profitCost],
    ["", "AS BID DETAILS:", "", "", Math.round(summary.totalWeight), "Lbs.", "", "", summary.costPerTon, "$/Ton", "", ""],
  ];
}

export function buildExportRows(estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  return [
    [`${estimate.jobNumber} - ${estimate.jobName}`, new Date().toISOString().slice(0, 19).replace("T", " ")],
    [],
    ["Summary", "", estimate.pieces.length],
    ["Total Material Weight (#)", summary.totalWeight],
    ["Total Material Cost", summary.materialCost, "$"],
    ["Drop Percentage", settings.dropPct],
    ["Drop Weight", summary.dropWeight],
    ["Drop Cost", summary.dropCost],
    ["Buyout Cost", summary.buyoutCost],
    ["Inbound Freight Cost", summary.inboundFreightCost],
    ["Jobsite Freight Distance (Miles)", estimate.info.distanceToJobMiles],
    ["Jobsite Freight Cost", summary.jobsiteFreightCost],
    ["Total Weld Material Weight (#)", summary.weldMaterialWeight],
    ["Total Weld Material Cost", summary.weldMaterialCost],
    ["Paint Cost", summary.paintCost],
    ["Field Bolts", estimate.info.fieldBoltsEach],
    ["Field Bolts Cost", summary.fieldBoltsCost],
    ["Detailing Cost", summary.detailingCost],
    ["Total Shop Labor (Hrs)", summary.laborHours.total, "Cut", summary.laborHours.cut, "Move", summary.laborHours.move, "Layout", summary.laborHours.layout, "Weld", summary.laborHours.weld],
    ["Shop Labor Rates", "", "Cut", settings.cutRatePerHour, "Move", settings.moveRatePerHour, "Layout", settings.layoutRatePerHour, "Weld", settings.weldRatePerHour],
    ["Total Shop Labor Cost", summary.laborCost],
    ["Shop Overhead Percentage", settings.shopOverheadPct],
    ["Shop Overhead Cost", summary.overheadCost],
    ["Erecting Cost", summary.erectionCost],
    ["Total Job Cost", summary.subtotalBeforeSales],
    ["Sales & Administration Percentage", settings.salesAdminPct],
    ["Sales & Administration Cost", summary.salesAdminCost],
    ["Profit Percentage", settings.profitPct],
    ["Profit Cost", summary.profitCost],
    ["Total Cost Including Profit", summary.grandTotal],
    ["Bid Date", estimate.info.estimateDate],
    ["Tonnage", summary.totalTons],
    ["Labor (Hrs/Ton)", summary.totalTons ? round(summary.laborHours.total / summary.totalTons, 2) : 0],
    ["Shop Efficiency Percentage", settings.efficiencyPct],
    ["Location", estimate.info.location],
    ["Group Name", estimate.info.groupName],
    ["Group Name 2", estimate.info.groupName2],
    [],
    ["Pieces"],
    ["Page", "Item", "Part #", "Qty/Main", "Main Mult", "Eff Qty", "Main", "Linked To", "Code", "Category", "Sub-Category", "Sequence", "Shape", "Description", "Length (ft)", "Weight/pc", "Total Weight", "Weld", "Cut Hrs", "Move Hrs", "Layout Hrs", "Weld Hrs", "Line Total"],
    ...estimate.pieces.map((piece) => {
      const calc = calcPiece(piece, settings, estimate.pieces);
      return [
        piece.page,
        piece.item,
        piece.partNumber,
        piece.quantity,
        calc.mainMultiplier,
        calc.effectiveQuantity,
        piece.isMainPiece ? "Yes" : "",
        piece.mainPieceId ? estimate.pieces.find((row) => row.id === piece.mainPieceId)?.item ?? "" : "",
        piece.extraCode,
        piece.category,
        piece.subCategory,
        piece.sequence,
        piece.shape,
        piece.description,
        calc.lengthFeet,
        calc.weightPerPiece,
        calc.totalWeight,
        calc.weldSize,
        calc.cutHours,
        calc.moveHours,
        calc.layoutHours,
        calc.weldHours,
        calc.lineTotal,
      ];
    }),
  ];
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
  return [
    [field === "category" ? "Category" : field === "subCategory" ? "Sub-Category" : "Sequence", "Pieces", "Effective Qty", "Weight", "Hours", "Total"],
    ...Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, row]) => [key, row.pieces, round(row.qty, 2), round(row.weight, 2), round(row.hours, 2), round(row.total, 2)]),
  ];
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "<Cell/>";
  if (typeof value === "number") return `<Cell><Data ss:Type="Number">${Number.isFinite(value) ? value : 0}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

function xmlWorksheet(name: string, rows: unknown[][]) {
  const rowXml = rows
    .map((row) => `<Row>${row.map((cell) => xmlCell(cell)).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${rowXml}</Table></Worksheet>`;
}

export function buildExcelXmlWorkbook(estimate: JobEstimate, summary: EstimateSummary, settings: EstimateSettings) {
  const summaryRows = buildSummaryRows(estimate, summary, settings);
  const exportRows = buildExportRows(estimate, summary, settings);
  const categoryRows = summarizeByField(estimate, settings, "category");
  const subCategoryRows = summarizeByField(estimate, settings, "subCategory");
  const sequenceRows = summarizeByField(estimate, settings, "sequence");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
 </Styles>
 ${xmlWorksheet("Summary", summaryRows)}
 ${xmlWorksheet("ExportedData", exportRows)}
 ${xmlWorksheet("CategoryReport", categoryRows)}
 ${xmlWorksheet("SubCategoryReport", subCategoryRows)}
 ${xmlWorksheet("SequenceReport", sequenceRows)}
</Workbook>`;
}
