# Content Flow

```
content-flow-main/
├── frontend/     React app on http://localhost:8080
├── backend/      Express API on http://localhost:8081
└── supabase/     Auth, Postgres, Storage (migrations)
```

## First-time setup

```bash
npm install
```

That installs root tooling plus `frontend/` and `backend/` dependencies.

You only maintain **two** env files (plus example templates you do not edit):

| File | App | What goes in it |
|------|-----|-----------------|
| `frontend/.env` | React (8080) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `backend/.env` | Express (8081) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, LLM and social keys |

Copy from the examples if a file is missing, then fill in real values. There is no root `.env`.

## Run both

From the project root:

```bash
npm run dev
```

| App | URL | Folder |
|-----|-----|--------|
| Frontend | http://localhost:8080 | `frontend/` |
| Backend | http://localhost:8081 | `backend/` |

```bash
curl http://localhost:8081/health
```

## Run separately

```bash
npm run dev:frontend
npm run dev:backend
```

## Deploy: Vercel (frontend) + Render (backend)

**Full checklist:** [`frontend/DEPLOY.md`](frontend/DEPLOY.md)

**Vercel (UI)** — Root Directory: `frontend`

| Variable | Vercel type | Notes |
|----------|-------------|--------|
| `VITE_SUPABASE_URL` | **Config** | Same as local `frontend/.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Config** | Anon key — not Secret |
| `API_PROXY_ORIGIN` | Secret or Config | Render URL (build maps this to client `VITE_API_URL`) |
| `VITE_API_URL` | — | **Do not add** in Vercel UI unless you prefer **Config** manually |

Redeploy after changing env vars.

**Render (API)** — Start: `npm run start`; env from `backend/.env.example`; **`FRONTEND_ORIGIN`** = Vercel URL (required for CORS).

Do **not** run `vite` / `npm run dev` on Render or as the Vercel start command — Vercel serves the static `dist` build.
