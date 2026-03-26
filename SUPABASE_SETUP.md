# Supabase Setup Guide

This guide will help you connect your ContentFlow project to Supabase.

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project (or create a new one)
3. Navigate to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

## Step 2: Configure Environment Variables

### Option 1: Using .env.local file (Recommended for local development)

1. Create a `.env.local` file in the root directory (if it doesn't exist)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
```

**Example:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option 2: Using .env file

1. Create a `.env` file in the root directory
2. Add the same variables as above

**Note:** `.env.local` takes precedence over `.env` in Vite

## Step 3: Run Database Migrations

You need to run the database migrations to set up the tables:

### Option A: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order:
   - `supabase/migrations/20260102155501_3144baa9-c56a-407b-96ba-a613efdf2cac.sql`
   - `supabase/migrations/20260103102116_a03caafd-1a32-4086-993c-543c32deccbd.sql`
   - `supabase/migrations/20260105041239_1701d2c8-1f99-4788-a762-d9982ca8e481.sql`
   - `supabase/migrations/20260106000000_add_media_type_column.sql`

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Step 4: Set Up Storage Bucket

The storage bucket should be created automatically by the migration, but verify:

1. Go to **Storage** in your Supabase dashboard
2. Check if `content-media` bucket exists
3. If not, create it:
   - Name: `content-media`
   - Public: Yes (checked)
   - File size limit: 50MB
   - Allowed MIME types: `image/*,video/*`

## Step 5: Set Up Edge Functions Secrets

For LLM preprocessing to work, set up your API keys:

1. Go to **Settings** → **Edge Functions** → **Secrets**
2. Add your LLM API key (see `LLM_SETUP.md` for details)

**Required for preprocessing:**
- `OPENROUTER_API_KEY` (or `OPENAI_API_KEY` or `GEMINI_API_KEY`)
- `LLM_PROVIDER` (openrouter, openai, or gemini)

## Step 6: Verify Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser
3. Try to sign up/sign in
4. Check the browser console for any errors

## Troubleshooting

### Error: "Missing env.VITE_SUPABASE_URL"

- Make sure your `.env.local` or `.env` file exists in the root directory
- Verify the variable names are exactly: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Restart your dev server after adding/changing environment variables

### Error: "Invalid API key" or "Invalid JWT"

- Double-check you're using the **anon/public** key, not the service_role key
- Make sure there are no extra spaces or quotes in your .env file
- Verify the key is correct in your Supabase dashboard

### Database errors

- Make sure all migrations have been run
- Check the Supabase dashboard → Database → Tables to verify tables exist
- Verify RLS (Row Level Security) policies are set up correctly

### Storage errors

- Verify the `content-media` bucket exists
- Check bucket policies allow uploads
- Ensure bucket is set to public

## Environment Variables Reference

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key | Settings → API → anon public |

## Next Steps

After connecting to Supabase:

1. ✅ Set up your LLM API key (see `LLM_SETUP.md`)
2. ✅ Test user registration and login
3. ✅ Test content upload
4. ✅ Verify admin login works
5. ✅ Test media preprocessing

## Security Notes

- **Never commit** `.env.local` or `.env` files to git
- The `.env.example` file is safe to commit (it has no real keys)
- Use the **anon/public** key in the frontend (it's safe for client-side use)
- The **service_role** key should only be used in server-side code/Edge Functions

