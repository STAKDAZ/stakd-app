# STAKD App

This is a STAKD-branded copy of the uploaded Dura Steel app.

## What was changed
- Replaced the Dura Steel logo with `public/stakd-logo.png`.
- Replaced visible Dura Steel branding with STAKD.
- Replaced `durasteelaz.com` references with `stakdaz.com`.
- Removed `.env.local`, `.next`, and `node_modules` from the deliverable zip.
- Added `.env.example` so secrets can be configured safely.

## Setup
1. Run `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Fill in Supabase, Resend, and Google Drive credentials.
4. Run the SQL files in `supabase/`, starting with `production_foundation.sql` after the base tables exist.
5. Run `npm run dev`.

## Deploy
Create a Vercel project from the GitHub repo, then add the same environment variables from `.env.local` in Vercel Project Settings.

## Current production baseline
- Admin routes use Supabase Auth in the browser, while server APIs now validate Supabase bearer tokens.
- Supabase RLS and the SQL functions in `supabase/production_foundation.sql` are required for real authorization.
- Google Drive provisioning uses OAuth refresh-token credentials. New jobs are created in `GOOGLE_DRIVE_QUOTING_PARENT_ID`, won jobs move to `GOOGLE_DRIVE_CURRENT_PARENT_ID`, lost jobs move to `GOOGLE_DRIVE_ARCHIVED_LOST_PARENT_ID` when present, and completed/billed jobs move to `GOOGLE_DRIVE_ARCHIVED_COMPLETED_PARENT_ID` when present. Both archived subfolders fall back to `GOOGLE_DRIVE_ARCHIVED_PARENT_ID`.
