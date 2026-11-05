# Deploy frontend (Vercel) + backend (Render)

## Vercel project settings

| Setting | Value |
|--------|--------|
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

---

## Vercel environment variables

| Key | Type | Value |
|-----|------|--------|
| `VITE_SUPABASE_URL` | **Config** | `https://YOUR_PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Config** | Supabase anon key |
| `API_PROXY_ORIGIN` | Secret or Config | `https://YOUR-SERVICE.onrender.com` (no trailing `/`) |

**Do not set `VITE_API_URL` on Vercel** when using `API_PROXY_ORIGIN`. The build keeps the client on **same-origin** `/api/*`; `vercel.json` rewrites proxy to Render (no browser CORS). On each deploy, `scripts/generate-vercel-config.mjs` refreshes the rewrite from `API_PROXY_ORIGIN`.

Redeploy after any env change.

---

## Render (backend)

- **Start:** `npm run start`
- **Env:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`FRONTEND_ORIGIN`:** optional when using Vercel proxy (browser does not call Render directly). Set it if you switch to direct `VITE_API_URL` mode.
- Apply all `supabase/migrations/`

---

## Supabase Auth

Site URL + redirect URLs = your Vercel URL.

---

## Verify (after redeploy)

1. [Render `/health`](https://YOUR-SERVICE.onrender.com/health) → `"ok": true`
2. Sign in on Vercel → **Network** tab  
3. Requests must be **`https://YOUR-APP.vercel.app/api/content`** (same domain), **not** `onrender.com`  
4. Status **401/200** with JSON — **not** “CORS error”

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| **CORS error** + `onrender.com` in Network URL | Old deploy — push latest code, redeploy; clear `VITE_API_URL` on Vercel |
| CORS error + `vercel.app/api` | Check `API_PROXY_ORIGIN`; Render `/health`; Render logs |
| Blank page | Missing `VITE_SUPABASE_*`, redeploy |
| 502 / 503 / 504 / 505 on `/api/*` | Render cold start or timeout — open `/health`, wait for `"ok":true`, retry; ensure `API_PROXY_ORIGIN` is set on Vercel |
