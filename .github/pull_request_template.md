## Summary

-

## Risk Level

- [ ] Low (UI/docs only)
- [ ] Medium (backend logic / query changes)
- [ ] High (schema/auth/deploy behavior)

## Validation

- [ ] Frontend builds locally
- [ ] Backend starts locally
- [ ] Core flows tested (login, timer, history, invoice)

## Database / Migration

- [ ] No schema changes
- [ ] New migration added under `supabase/migrations/`
- [ ] Migration is wrapped in `BEGIN;` / `COMMIT;`
- [ ] Staging migration path considered

## Deployment

- [ ] Required env vars documented/updated
- [ ] CORS/auth impact reviewed
- [ ] Rollback approach considered
