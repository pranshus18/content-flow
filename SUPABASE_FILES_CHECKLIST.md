# Supabase Connection Files Checklist

## ✅ Files Already Configured

These files are already set up and ready to use:

### 1. Supabase Client (`src/integrations/supabase/client.ts`)
- ✅ Configured to read from environment variables
- ✅ Validates that env vars are present
- ✅ Creates Supabase client with proper auth settings

### 2. Database Migrations (`supabase/migrations/`)
- ✅ `20260102155501_3144baa9-c56a-407b-96ba-a613efdf2cac.sql` - Creates content and settings tables
- ✅ `20260103102116_a03caafd-1a32-4086-993c-543c32deccbd.sql` - Additional migrations
- ✅ `20260105041239_1701d2c8-1f99-4788-a762-d9982ca8e481.sql` - Admin roles and workflow
- ✅ `20260106000000_add_media_type_column.sql` - Adds media_type column

### 3. Edge Functions (`supabase/functions/`)
- ✅ `preprocess-media/` - LLM-based media preprocessing
- ✅ `enhance-media/` - Media enhancement
- ✅ `publish-content/` - Content publishing
- ✅ `publish-social/` - Social media publishing
- ✅ `fetch-analytics/` - Analytics fetching

## 📝 Files You Need to Create/Update

### 1. Environment Variables File

**File:** `.env` or `.env.local` (in root directory)

**Content:**
```env
VITE_SUPABASE_URL=your-supabase-project-url-here
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key-here
```

**Where to get values:**
- Go to: https://app.supabase.com/project/_/settings/api
- Copy "Project URL" → `VITE_SUPABASE_URL`
- Copy "anon public" key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. Supabase Config (Optional)

**File:** `supabase/config.toml` (already exists)

This file contains your project ID. Update it if needed.

## 🔧 Setup Steps

### Step 1: Create .env file

Create `.env` or `.env.local` in the root directory with your Supabase credentials.

### Step 2: Run Database Migrations

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project → SQL Editor
2. Copy and run each migration file in order:
   - `supabase/migrations/20260102155501_3144baa9-c56a-407b-96ba-a613efdf2cac.sql`
   - `supabase/migrations/20260103102116_a03caafd-1a32-4086-993c-543c32deccbd.sql`
   - `supabase/migrations/20260105041239_1701d2c8-1f99-4788-a762-d9982ca8e481.sql`
   - `supabase/migrations/20260106000000_add_media_type_column.sql`

**Option B: Via Supabase CLI**
```bash
supabase link --project-ref your-project-ref
supabase db push
```

### Step 3: Verify Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Verify `content-media` bucket exists
3. If not, create it:
   - Name: `content-media`
   - Public: ✅ Yes
   - File size limit: 50MB

### Step 4: Set Edge Function Secrets

1. Go to Supabase Dashboard → Settings → Edge Functions → Secrets
2. Add your LLM API key:
   ```
   OPENROUTER_API_KEY=your-key-here
   LLM_PROVIDER=openrouter
   ```

### Step 5: Restart Dev Server

```bash
npm run dev
```

## ✅ Verification

After setup, verify connection:

1. **Check browser console** - No Supabase errors
2. **Try signing up** - Should create user successfully
3. **Try admin login** - Should work with credentials
4. **Upload content** - Should upload to Supabase storage

## 📋 File Structure Summary

```
project-root/
├── .env                    # ← CREATE THIS with your Supabase keys
├── .env.local              # ← OR CREATE THIS (takes precedence)
├── src/
│   └── integrations/
│       └── supabase/
│           ├── client.ts   # ✅ Already configured
│           └── types.ts    # ✅ Auto-generated
├── supabase/
│   ├── config.toml        # ✅ Project config
│   ├── migrations/        # ✅ All migrations ready
│   └── functions/          # ✅ All functions ready
└── SUPABASE_SETUP.md      # ✅ Detailed setup guide
```

## 🚨 Important Notes

1. **Never commit** `.env` or `.env.local` to git (already in .gitignore)
2. **Restart dev server** after changing .env variables
3. **Use anon/public key** in frontend (not service_role key)
4. **Run migrations in order** (they're numbered by date)

## Need Help?

- See `SUPABASE_SETUP.md` for detailed instructions
- See `LLM_SETUP.md` for LLM API key setup
- Check browser console for specific error messages

