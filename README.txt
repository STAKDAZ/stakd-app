Dura Steel Estimating Revamp UI Patch

Replace these files in your local dura-steel-app folder:
1) app/admin/estimating/page.tsx
2) lib/estimating-db.ts
3) lib/estimating-engine.ts

Then run:
npm install
npm run dev

What this does:
- Adds a Tekla-style right-side piece editor on the Estimating > Pieces tab.
- Uses your Supabase material master tables for the material size dropdown.
- Keeps the line-item grid readable without scrolling sideways through every field.
- Updates estimating save/load to match the new estimating_estimates + estimating_items tables you created.
- Adds the new formula/rate/material estimating engine helper.
