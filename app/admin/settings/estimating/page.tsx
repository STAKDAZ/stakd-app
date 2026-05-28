"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addFormula,
  addOperation,
  createLaborCode,
  getLaborCodes,
  getLaborFormulas,
  getLaborOperations,
  getMaterialGroups,
} from "@/lib/estimating-db";

type AnyRow = Record<string, any>;

export default function EstimatingSettingsPage() {
  const [groups, setGroups] = useState<AnyRow[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AnyRow | null>(null);
  const [codes, setCodes] = useState<AnyRow[]>([]);
  const [selectedCode, setSelectedCode] = useState<AnyRow | null>(null);
  const [operations, setOperations] = useState<AnyRow[]>([]);
  const [formulas, setFormulas] = useState<AnyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [opDescription, setOpDescription] = useState("");
  const [opQty, setOpQty] = useState("1");
  const [opGroup, setOpGroup] = useState("Processing");

  const [formulaDescription, setFormulaDescription] = useState("");
  const [formulaQty, setFormulaQty] = useState("1");
  const [formulaType, setFormulaType] = useState("BURN_THICKNESS_WIDTH");
  const [formulaJson, setFormulaJson] = useState('{"type":"BURN_THICKNESS_WIDTH"}');


  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      setLoading(true);
      setError(null);
      const data = await getMaterialGroups();
      setGroups(data);
      setSelectedGroup(data[0] ?? null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load estimating settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedGroup) return;
    loadCodes(selectedGroup.id);
  }, [selectedGroup?.id]);

  async function loadCodes(groupId: string) {
    try {
      setError(null);
      const data = await getLaborCodes(groupId);
      setCodes(data);
      setSelectedCode(data[0] ?? null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load labor codes.");
    }
  }

  useEffect(() => {
    if (!selectedCode) {
      setOperations([]);
      setFormulas([]);
      return;
    }
    loadDetails(selectedCode.id);
  }, [selectedCode?.id]);

  async function loadDetails(codeId: string) {
    try {
      setError(null);
      const [ops, forms] = await Promise.all([
        getLaborOperations(codeId),
        getLaborFormulas(codeId),
      ]);
      setOperations(ops);
      setFormulas(forms);
    } catch (e: any) {
      setError(e.message ?? "Failed to load code details.");
    }
  }

  async function handleCreateCode() {
    if (!selectedGroup || !newCode.trim()) return;
    await createLaborCode({
      material_group_id: selectedGroup.id,
      code: newCode.trim().toUpperCase(),
      description: newDescription.trim() || newCode.trim().toUpperCase(),
    });
    setNewCode("");
    setNewDescription("");
    await loadCodes(selectedGroup.id);
  }

  async function handleAddOperation() {
    if (!selectedCode || !opDescription.trim()) return;
    await addOperation({
      labor_code_id: selectedCode.id,
      description: opDescription.trim(),
      qty: Number(opQty) || 1,
      group_name: opGroup,
    });
    setOpDescription("");
    setOpQty("1");
    await loadDetails(selectedCode.id);
  }

  async function handleAddFormula() {
    if (!selectedCode || !formulaDescription.trim()) return;
    let expression: Record<string, any>;
    try {
      expression = JSON.parse(formulaJson);
    } catch {
      setError("Formula JSON is invalid.");
      return;
    }

    await addFormula({
      labor_code_id: selectedCode.id,
      description: formulaDescription.trim(),
      qty: Number(formulaQty) || 1,
      formula_type: formulaType,
      expression,
    });
    setFormulaDescription("");
    setFormulaQty("1");
    await loadDetails(selectedCode.id);
  }

  if (loading) return <div className="p-6">Loading estimating settings...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estimating Settings</h1>
          <p className="text-sm text-zinc-600">
            Control material groups, labor codes, operations, and formulas from Supabase.
          </p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 text-sm shadow-sm">
          Preview uses: 1 pc, 1/2&quot; thick, 6&quot; width/flange, 120&quot; length, 4 holes.
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 rounded-2xl border bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 font-semibold">Material Groups</h2>
          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  selectedGroup?.id === group.id ? "bg-black text-white" : "bg-zinc-100 hover:bg-zinc-200"
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </section>

        <section className="col-span-12 rounded-2xl border bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-3 font-semibold">Labor Codes</h2>
          <div className="mb-4 space-y-2 rounded-xl bg-zinc-50 p-3">
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Code, ex: B or BB-1" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
            <button onClick={handleCreateCode} className="w-full rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white">Add Code</button>
          </div>
          <div className="space-y-2">
            {codes.map((code) => (
              <button
                key={code.id}
                onClick={() => setSelectedCode(code)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                  selectedCode?.id === code.id ? "bg-emerald-700 text-white" : "bg-zinc-100 hover:bg-zinc-200"
                }`}
              >
                <div className="font-semibold">{code.code}</div>
                <div className="text-xs opacity-80">{code.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="col-span-12 rounded-2xl border bg-white p-4 shadow-sm lg:col-span-4">
          <h2 className="mb-3 font-semibold">Operations</h2>
          {selectedCode ? (
            <>
              <div className="mb-4 grid grid-cols-5 gap-2 rounded-xl bg-zinc-50 p-3">
                <input className="col-span-3 rounded-lg border px-3 py-2 text-sm" placeholder="Operation description" value={opDescription} onChange={(e) => setOpDescription(e.target.value)} />
                <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Qty" value={opQty} onChange={(e) => setOpQty(e.target.value)} />
                <select className="rounded-lg border px-3 py-2 text-sm" value={opGroup} onChange={(e) => setOpGroup(e.target.value)}>
                  <option>Processing</option>
                  <option>Shop Labor</option>
                </select>
                <button onClick={handleAddOperation} className="col-span-5 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white">Add Operation</button>
              </div>
              <div className="space-y-2">
                {operations.map((op) => (
                  <div key={op.id} className="rounded-xl border p-3 text-sm">
                    <div className="font-semibold">{op.qty} × {op.description}</div>
                    <div className="text-xs text-zinc-500">{op.group_name || "No group"}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-sm text-zinc-500">Select a labor code.</div>}
        </section>

        <section className="col-span-12 rounded-2xl border bg-white p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-3 font-semibold">Formulas</h2>
          {selectedCode ? (
            <>
              <div className="mb-4 space-y-2 rounded-xl bg-zinc-50 p-3">
                <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Formula description" value={formulaDescription} onChange={(e) => setFormulaDescription(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Qty" value={formulaQty} onChange={(e) => setFormulaQty(e.target.value)} />
                  <select className="rounded-lg border px-3 py-2 text-sm" value={formulaType} onChange={(e) => setFormulaType(e.target.value)}>
                    <option>BURN_THICKNESS_WIDTH</option>
                    <option>BURN_FLANGE</option>
                    <option>FULL_PEN_WELD</option>
                    <option>FILLET_PERIMETER</option>
                    <option>STITCH_WELD_LENGTH</option>
                    <option>HOLES</option>
                    <option>PUNCH_OR_DRILL_HOLES</option>
                    <option>SHOP_BOLTS</option>
                    <option>FIELD_BOLTS</option>
                  </select>
                </div>
                <textarea className="h-24 w-full rounded-lg border px-3 py-2 font-mono text-xs" value={formulaJson} onChange={(e) => setFormulaJson(e.target.value)} />
                <button onClick={handleAddFormula} className="w-full rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white">Add Formula</button>
              </div>
              <div className="space-y-2">
                {formulas.map((formula) => (
                  <div key={formula.id} className="rounded-xl border p-3 text-sm">
                    <div className="font-semibold">{formula.qty} × {formula.description}</div>
                    <div className="text-xs text-zinc-500">{formula.formula_type}</div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="text-sm text-zinc-500">Select a labor code.</div>}
        </section>
      </div>

      
    </div>
  );
}
