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
4. Run `npm run dev`.

## Deploy
Create a Vercel project from the GitHub repo, then add the same environment variables from `.env.local` in Vercel Project Settings.
