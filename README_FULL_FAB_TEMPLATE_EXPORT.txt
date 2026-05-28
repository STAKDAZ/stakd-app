This patch changes the estimator export to use the actual Full Fab workbook as the Excel template.

Files included:
- lib/full-fab-template.ts: embedded Full Fab template workbook
- lib/estimating-export.ts: writes estimate data into the template while preserving colors/layout/formulas
- app/admin/estimating/page.tsx: export button downloads a real .xlsx Full Fab workbook
- package.json: includes exceljs

After replacing files:
1. Run npm install
2. Run npm run dev
3. Export from the estimating tab
