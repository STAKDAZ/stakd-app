Estimating input/save patch

Replaces:
- app/admin/estimating/page.tsx
- lib/estimating.ts
- lib/estimating-db.ts

Fixes:
- Enter key advances to the next field in the piece editor.
- F1 creates a new line and immediately selects/focuses it.
- F4 always saves the current estimate, not only dirty-flagged changes.
- Each save keeps a browser-local backup before Supabase save.
- Loading a job can recover from browser-local backup if Supabase is empty.
- Supabase header notes now also keep a full estimate backup.
- Piece editor stays sticky while scrolling.
- Manual weight field replaced with Additional holes.
- Additional holes add cut/processing labor.
- Manual weld LF field added and contributes weld labor.
- Material selection now supports Shape + Size typing, e.g. W + 8X10 or L + 3X3X1/4.

After replacing files:
npm run build
npm run dev
