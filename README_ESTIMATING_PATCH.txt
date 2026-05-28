Dura Steel App V18 - Estimating Engine Patch

Files changed:
- lib/estimating-engine.ts
- supabase/estimating_revamp_seed_notes.sql

What this patch adds:
- A Supabase-backed calculateItem() estimating engine function.
- Dynamic material lookup from estimating_material_sizes.
- Dynamic labor code formula lookup from estimating_labor_code_formulas.
- Dynamic rate lookup from estimating_rates.
- Processing/shop hour split.
- Total weight calculation.
- Backward compatibility with the older calculateLabor()/runFormula() exports.

Important:
- This patch does NOT fully rebuild the estimating screen yet.
- It gives us the engine file needed before wiring the Tekla-style right-side editor UI.

Install:
1. Copy/replace these files into your local dura-steel-app folder.
2. Run: npm install
3. Run: npm run dev
4. Next we wire this function into the estimating page UI.
