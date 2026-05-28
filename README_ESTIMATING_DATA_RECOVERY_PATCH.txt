Estimating data recovery / guardrail patch

Files included:
- app/admin/estimating/page.tsx
- lib/estimating-db.ts

What this fixes:
1. Makes the estimating page open directly to the Pieces tab after selecting/loading a job so the Tekla-style piece editor is visible.
2. If Supabase loads an empty estimate but the browser still has old local estimate data, the app shows the local estimate instead of looking blank.
3. Prevents Save from wiping existing estimating item rows when the current UI state has zero pieces.
4. When older empty estimate headers exist, the loader scans recent headers and uses the newest one that actually has item rows.

After replacing files:
- npm run build
- npm run dev

Then check job 26-0029 on the same computer/browser where the estimator entered the estimate. If the rows existed in browser local storage, they should reappear. Click Save to write them back to Supabase.
