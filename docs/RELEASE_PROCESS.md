# Release Process (Safe by Default)

## Goal

Ship changes quickly while reducing the chance of breaking production.

## Standard flow

1. Create a feature branch from `main`.
2. Open a pull request.
3. CI must pass:
   - Frontend build
   - Backend syntax checks
   - Migration validation (if SQL migrations changed)
4. Merge to `main`.
5. Run staging database migrations manually via GitHub Actions.
6. Verify staging behavior.
7. Trigger production migration workflow manually.
8. Approve production deploy via GitHub environment protection.

## Required GitHub protections

Enable branch protection on `main`:

- Require pull request before merging.
- Require status checks to pass:
  - `frontend-build`
  - `backend-sanity`
  - `migration-validate` (when applicable)
- Require conversation resolution before merge.
- Restrict force pushes to `main`.

Configure GitHub environments:

- `staging`
  - Add Supabase staging secrets.
- `production`
  - Add Supabase production secrets.
  - Require at least 1 reviewer before deployment.

## Migration rollback strategy

Use forward-only fixes:

- If a migration causes an issue, create a new corrective migration.
- Do not edit already-merged migration files.

## High-confidence deploy checklist

- PR includes migration + app code together when schema changes are required.
- CI green on PR.
- Staging verified with real app flows (login, invoice, history, settings).
- Production migration manually approved.
