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

| Key | Type in Vercel | Value |
|-----|----------------|--------|
| `VITE_SUPABASE_URL` | **Config** (not Secret) | `https://YOUR_PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Config** (not Secret) | Supabase anon / publishable key |
| `API_PROXY_ORIGIN` | **Secret** or **Config** | `https://YOUR-SERVICE.onrender.com` (no trailing `/`) |

Copy Supabase values from local `frontend/.env`.

**Do not add `VITE_API_URL` in the Vercel UI** unless you want to manage it manually as **Config**. On each build, `scripts/verify-vercel-env.mjs` copies `API_PROXY_ORIGIN` into `VITE_API_URL` for the client bundle (avoids Secret + `VITE_` UI errors).

After any env change → **Deployments → Redeploy**.

---

## Render (backend)

| Setting | Value |
|--------|--------|
| **Build** | `npm install` (or root `npm install` if using monorepo start) |
| **Start** | `npm run start` |

**Environment** (from `backend/.env.example`):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`FRONTEND_ORIGIN`** = your Vercel URL, e.g. `https://content-flow-wheat-pi.vercel.app` (**required** — browser calls Render directly for `/api`)
- Optional: `FRONTEND_EXTRA_ORIGINS` for preview URLs
- Leave `SERVE_FRONTEND` unset

Apply all SQL in `supabase/migrations/` to your Supabase project (missing tables → API **500** from Render).

---

## Supabase Auth

**Authentication → URL configuration**

- **Site URL** → Vercel production URL  
- **Redirect URLs** → same URL (+ preview URLs if needed)

---

## What loads after sign-in

The app fires several API calls in parallel (all need a healthy Render backend):

| Call | Purpose |
|------|--------|
| `POST /api/me/sync-role` | Profile / role sync (login) |
| `GET /api/me/role` | Admin vs user routing |
| `GET /api/content` | Main feed |
| `GET /api/branding` | Watermarks / logos |
| `GET /api/publishing-settings` | Auto-publish settings |

Until `me/role` finishes, the home page shows **Loading…** (Render cold start can take **30–90s** on free tier).

---

## Verify

1. `https://YOUR-SERVICE.onrender.com/health` → JSON `"ok": true`
2. Sign in on Vercel → **Network** tab  
3. API requests should go to **`https://YOUR-SERVICE.onrender.com/api/...`** (not `your-app.vercel.app/api/...`)  
4. Responses are JSON (`success` / `error` from Express), not HTML or Vercel `"A server error has occurred"`

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| Blank navy page | Missing `VITE_SUPABASE_*` or no redeploy after adding them |
| **`500` on `vercel.app/api/*`** | Old Edge middleware deploy — **remove** any `/api` rewrites; redeploy latest code (no middleware; client uses Render URL) |
| CORS / blocked API | Set **`FRONTEND_ORIGIN`** on Render to your exact Vercel URL; redeploy Render |
| “Backend returned a non-JSON response” | Wrong API URL or HTML error page — check `API_PROXY_ORIGIN`, redeploy Vercel |
| Red failed requests: `content`, `branding`, `role`, `publishing-settings` | Wake Render (`/health`), check Render logs, confirm Supabase migrations + service role key |
| Long **Loading…** after login | Render cold start — wait or upgrade Render; open `/health` then refresh |
| Vercel won’t save `VITE_API_URL` | Don’t use it — only set **`API_PROXY_ORIGIN`** |
