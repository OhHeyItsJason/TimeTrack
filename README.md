# TimeTrack Monorepo

This repo is now split for GitHub/deployment:

- `frontend/` React + Vite app
- `backend/` local Node API + JSON datastore

## Local development

Install frontend deps:

```bash
cd frontend
npm install
```

Run backend (Terminal 1):

```bash
cd ../backend
npm install
npm run dev
```

Run frontend (Terminal 2):

```bash
cd ../frontend
npm run dev
```

App URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`

## First GitHub push (beginner steps)

From repo root (`timetrackatc-2`):

```bash
git init
git add .
git commit -m "Initial TimeTrack monorepo"
```

Create an empty repo on GitHub (no README/license), then run:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

## What to deploy later

- Deploy `frontend/` to Vercel.
- Deploy `backend/` to a backend host (Render/Railway/Fly).
- Point frontend env `VITE_API_BASE_URL` to deployed backend URL.

## Notes

- Backend data is in `backend/backend_data/db.json` (ignored by git).
- Seed template: `backend/backend_data/db.example.json`.
- Backend contract reverse-engineering notes are in `BACKEND_RECONSTRUCTION.md`.
- Safe release process: `docs/RELEASE_PROCESS.md`.
- Supabase migration guide: `supabase/README.md`.
- End-to-end setup checklist: `docs/SETUP_EVERYWHERE.md`.
