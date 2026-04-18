# TimeTrack Backend Reconstruction

This document reverse-engineers the backend contract expected by the exported TimeTrack frontend.

## 1) Required auth/session behavior

- Frontend expects `access_token` in URL or local storage and passes it to SDK.
- App boot sequence calls:
  - `GET /api/apps/public/prod/public-settings/by-id/:appId` with `X-App-Id` header.
  - If token exists, then `auth.me()` to fetch current user.
- Error behavior expected by frontend:
  - `403` with `extra_data.reason = "auth_required"` => show login flow.
  - `403` with `extra_data.reason = "user_not_registered"` => show not-registered screen.
  - `401/403` for `auth.me()` => treat as auth required.

## 2) Entities and inferred schema

All entities are CRUD-based and user-scoped.

### `Settings` (single row per user expected by UI)

- `id: string`
- `hourly_rate: number`
- `company_name: string`
- `email: string`
- `phone: string`
- `address: string`
- `invoice_notes: string`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- UI always uses `settings[0]`.

### `Client`

- `id: string`
- `name: string` (required)
- `email: string`
- `phone: string`
- `address: string`
- `hourly_rate: number | null`
- `abbreviation: string` (used for invoice numbering/status lookup)
- `color: string` (hex)
- `is_archived: boolean`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- Archive is soft-delete via `is_archived`.
- UI blocks archive if client has active work session (frontend check only).

### `WorkSession`

- `id: string`
- `date: string` (`YYYY-MM-DD`)
- `start_time: string (ISO)`
- `end_time: string (ISO) | null`
- `duration_minutes: number`
- `break_minutes: number`
- `is_active: boolean`
- `client_id: string | null`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- Timer page starts by creating active session.
- Stop updates same row with `end_time`, `duration_minutes`, `is_active=false`.
- History editor deletes all sessions for a day and recreates them.

### `DayMileage`

- `id: string`
- `date: string` (`YYYY-MM-DD`)
- `daily_miles_driven: number`
- `daily_round_trip: boolean`
- `daily_mileage_notes: string`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- UI expects one record per date and uses filter by `{ date }`.

### `Invoice`

- `id: string`
- `invoice_number: string`
- `client_name: string`
- `client_email: string`
- `client_phone: string`
- `client_address: string`
- `client_abbreviation: string`
- `start_date: string` (`YYYY-MM-DD`)
- `end_date: string` (`YYYY-MM-DD`)
- `selected_dates: string` (JSON array of date strings)
- `line_items: string` (JSON array of `{ date, hours, rate, amount }`)
- `invoice_format: "single" | "multiple"`
- `total_hours: number`
- `hourly_rate: number`
- `total_amount: number`
- `notes: string`
- `is_submitted: boolean`
- `is_paid: boolean`
- `generated_date: string (ISO)`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- Invoice history toggles `is_submitted` and `is_paid`.
- Edit modal blocks edits when `is_submitted=true` (frontend enforcement).

### `InvoiceCounter`

- `id: string`
- `client_id: string`
- `last_number_used: number`
- `created_date: string (ISO)`
- `updated_date: string (ISO)`
- `created_by: string` (user id)

Notes:
- Used to generate next `INV-{ABBR}{NN}` number per client.

## 3) API contract expected by frontend SDK layer

The frontend uses app-client entity methods:

- `list(sort?)`
- `filter(whereObject)`
- `create(payload)`
- `update(id, payload)`
- `delete(id)`

So a compatible REST contract can be:

- `GET /entities/:entity?sort=-field`
- `POST /entities/:entity`
- `GET /entities/:entity/filter?field=value`
- `PATCH /entities/:entity/:id`
- `DELETE /entities/:entity/:id`

Or map these methods in a local SDK adapter to your preferred API shape.

## 4) Sorting/filtering actually used

- `WorkSession.list('-start_time')`
- `WorkSession.list('-date')`
- `Client.list('name')`
- `Invoice.list()`
- `Invoice.list('-created_date')`
- `Invoice.list('-start_date')`
- `InvoiceCounter.list()`
- `Settings.list()`
- `DayMileage.list()`
- `DayMileage.filter({ date: 'YYYY-MM-DD' })`

## 5) Business logic that should move backend-side

These are currently frontend-only and should be enforced server-side:

- Ensure one active work session at a time per user.
- Validate `duration_minutes >= 0`, `break_minutes >= 0`.
- If `is_active=true`, require `start_time`, disallow `end_time`.
- If closing session, require `end_time >= start_time` (or explicit cross-midnight handling).
- Enforce single `Settings` row per user.
- Enforce one `DayMileage` row per user per date.
- Enforce unique invoice number per user.
- Optional: prevent editing submitted invoices.
- Optional: prevent archiving client with active session.

## 6) Existing server function in export

The export includes one backend function:

- `functions/generateInvoicePDF.js`

Behavior:
- Authenticates request with `appClient.auth.me()`.
- Accepts invoice payload JSON.
- Returns generated PDF bytes.

Current frontend mostly generates PDF client-side (`jspdf` in `InvoicePreviewModal`), so this endpoint is optional unless you want trusted server-side PDF generation.

## 7) Recommended DB constraints (Postgres)

- `settings`: unique index on `(created_by)`.
- `day_mileage`: unique index on `(created_by, date)`.
- `invoice`: unique index on `(created_by, invoice_number)`.
- `invoice_counter`: unique index on `(created_by, client_id)`.
- Foreign key: `work_session.client_id -> client.id` (nullable).

## 8) Minimal migration order

1. Auth and token verification middleware.
2. CRUD endpoints for all six entities with `created_by` tenant scoping.
3. Sorting/filtering support used above.
4. DB unique constraints.
5. Optional server-side PDF endpoint.
