# Setup Everywhere (GitHub + Supabase + Backend Host + Vercel + Wix)

## 1) GitHub

- Ensure `main` branch protection is enabled.
- Ensure environments exist:
  - `staging`
  - `production`
- In both environments, add secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
  - `SUPABASE_DB_PASSWORD`

## 2) Supabase

Create two projects:

- `timetrack-staging`
- `timetrack-production`

For each, record:

- Project ref
- Database password
- Project URL
- Service role key

## 3) Apply DB schema

The initial schema migration file is:

`supabase/migrations/20260220060000_initial_schema.sql`

Apply via GitHub workflow (preferred) or Supabase SQL editor.

## 4) Backend host (Render/Railway/Fly)

Deploy folder: `backend/`

Set env vars:

- `PORT` (host-provided)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `AUTH_TOKEN_TTL_SECONDS=604800`
- `ALLOW_ADMIN_BYPASS=false`
- `CORS_ALLOW_ORIGIN=https://app.<your-domain>`
- `SUPABASE_URL=<your project url>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`

Health check endpoint:

- `/api/health`

## 5) Vercel frontend

Deploy folder: `frontend/`

Set env var:

- `VITE_API_BASE_URL=https://api.<your-domain>`

Redeploy after setting env.

## 6) Wix DNS

Add records:

- `app.<your-domain>` CNAME -> Vercel target
- `api.<your-domain>` CNAME -> backend host target

## 7) Smoke test

- Open `https://app.<your-domain>`.
- Confirm login loads.
- Test invalid login => generic error.
- Test valid login => app loads.
- Verify pages:
  - Timer
  - Work History
  - Invoice
  - Invoice History
  - Settings

## 8) Safe deployment pattern

- All code changes via PR.
- CI green before merge.
- Migrations deploy to staging first.
- Production migrations via manual workflow with approval.
