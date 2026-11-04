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

**Render (API only)**

- Root: repo root or `backend/` if you use a backend-only service
- Build: `npm install` (no frontend build required)
- Start: `npm run start --prefix backend` or `npm start` from root
- Env: all keys from `backend/.env.example`
- Set `FRONTEND_ORIGIN` to your Vercel URL (e.g. `https://your-app.vercel.app`)
- Leave `SERVE_FRONTEND` unset or `false`

**Vercel (UI)**

- Root Directory: `frontend`
- Framework: Vite (or use `frontend/vercel.json`)
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL=https://your-service.onrender.com`

Do **not** run `vite` / `npm run dev` on Render or as the Vercel start command — Vercel serves the static `dist` build.
