# Supabase Migrations

This folder stores SQL migrations applied to Supabase.

## Migration file naming

Use:

`YYYYMMDDHHMMSS_description.sql`

Example:

`20260220094500_create_invoice_table.sql`

Current initial schema migration:

`supabase/migrations/20260220060000_initial_schema.sql`

## Migration safety rules

- Wrap every migration in:
  - `BEGIN;`
  - `COMMIT;`
- Keep each migration forward-only and immutable after merge.
- Never edit old merged migration files. Add a new migration instead.

## GitHub environments/secrets

Set these secrets in both `staging` and `production` GitHub environments:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

## Deploy flow

- Push to `main` with migration changes:
  - Auto deploys to `staging` (if staging secrets are configured).
- Production deploy:
  - Run the **Supabase Migrations** workflow manually with target `production`.
  - Use required reviewers on the `production` environment for approval gating.

## Backend storage switch

Backend uses local JSON by default.

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in backend env,
the backend automatically switches to Supabase tables using the same API contract.
