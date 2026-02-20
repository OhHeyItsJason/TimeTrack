# Backend

Simple Node HTTP API with JSON persistence.

## Run

```bash
npm install
npm run dev
```

## Auth

Copy env template and set your admin credentials:

```bash
cp .env.example .env
```

Required values:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`

Default login page is served by the frontend and calls `POST /api/auth/login`.

Optional local safety switch:

- `ALLOW_ADMIN_BYPASS=true`

When enabled, localhost requests can access the app as admin even without a token.
Use this only for local testing and set it to `false` for production.

## Data storage

Data file:

`backend_data/db.json`

Delete/reset this file if you want a clean local dataset.

Seed example included:

`backend_data/db.example.json`
