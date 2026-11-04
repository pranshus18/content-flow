# Deploy frontend (Vercel) + backend (Render)

## Vercel project settings

| Setting | Value |
|--------|--------|
| **Root Directory** | `frontend` |
| **Framework** | Vite |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |

Do **not** set a custom “Start Command” on Vercel (static site).

---

## Vercel environment variables

Add these in **Project → Settings → Environment Variables** for **Production** (and **Preview** if you use previews).

### Required

| Key | Type in Vercel | Value |
|-----|----------------|--------|
| `VITE_SUPABASE_URL` | **Config** (not Secret) | `https://YOUR_PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Config** (not Secret) | Supabase anon / publishable key |
| `API_PROXY_ORIGIN` | **Secret** or **Config** | `https://YOUR-SERVICE.onrender.com` (no trailing `/`) |

Copy Supabase values from local `frontend/.env`.

### Do **not** use on Vercel (recommended)

| Key | Why |
|-----|-----|
| `VITE_API_URL` as **Secret** | Vercel blocks `VITE_` + Secret (“remove the public framework prefix…”). |
| `VITE_API_URL` at all | Optional if you use `API_PROXY_ORIGIN`; the app calls same-origin `/api/*` and Edge proxy forwards to Render. |

If you insist on `VITE_API_URL`, set type **Config**, confirm it is OK to expose in the browser, and redeploy. Prefer **`API_PROXY_ORIGIN`** only.

After any env change → **Deployments → Redeploy** (Vite bakes `VITE_*` in at build time).

---

## Render (backend)

| Setting | Value |
|--------|--------|
| **Build** | `npm install; npm run build` (or install only if you skip frontend build on Render) |
| **Start** | `npm run start` (runs Express on `PORT`) |

**Environment** (from `backend/.env.example`):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_ORIGIN` = your Vercel URL, e.g. `https://content-flow-wheat-pi.vercel.app` (needed if the browser calls Render directly via `VITE_API_URL`; optional when using Vercel proxy only)
- Leave `SERVE_FRONTEND` unset

Apply Supabase migrations from `supabase/migrations/`.

---

## Supabase Auth

**Authentication → URL configuration**

- **Site URL** → Vercel production URL  
- **Redirect URLs** → same URL (+ preview URLs if needed)

---

## Verify

1. `https://YOUR-SERVICE.onrender.com/health` → JSON `"ok": true`
2. Open Vercel app → sign in  
3. DevTools → **Network** → `sync-role` / `me/role` → URL should be **`your-app.vercel.app/api/...`**, response **JSON** (not HTML)

First API call after Render idle can take **30–90 seconds** (free tier wake-up).

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Blank navy page | Missing `VITE_SUPABASE_*` or no redeploy after adding them |
| “Backend returned a non-JSON response” | `/api` not proxied — set `API_PROXY_ORIGIN`, push latest `frontend/` (middleware + `api/[...path].ts`), redeploy |
| Vercel won’t save `VITE_API_URL` | Use **Config**, or skip it and use **`API_PROXY_ORIGIN`** |
| Long “Loading…” after login | Render cold start; open `/health` on Render, then refresh |
