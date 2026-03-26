# CRM Integration - Complete Step-by-Step Checklist

## 🎯 Your Goal
Connect your Content Flow platform to your existing CRM to automatically capture leads from social media engagement (likes, comments, shares).

---

## 📋 PREPARATION PHASE

### Step 1: Gather CRM Information
- [ ] **What is your CRM platform?** (HubSpot, Salesforce, Pipedrive, custom, etc.)
- [ ] **Get your CRM API endpoint URL**
  - Example: `https://api.hubspot.com/crm/v3/objects/contacts`
  - Example: `https://your-crm.com/api/v1/leads`
- [ ] **Get your CRM API authentication method:**
  - [ ] API Key? (What's the key name? e.g., `X-API-Key`, `Authorization`)
  - [ ] Bearer Token? (OAuth token)
  - [ ] Basic Auth? (Username/Password)
- [ ] **Get API credentials:**
  - [ ] API Key or Token value
  - [ ] Any required headers
- [ ] **Test your CRM API:**
  - [ ] Make a test API call (use Postman or curl)
  - [ ] Verify you can create a contact/lead
  - [ ] Note the exact request format (JSON structure)

### Step 2: Understand Your CRM Data Structure
- [ ] **What fields does your CRM need for a lead/contact?**
  - [ ] Email (required/optional?)
  - [ ] First Name
  - [ ] Last Name
  - [ ] Phone
  - [ ] Company
  - [ ] Source (where lead came from)
  - [ ] Notes/Description
  - [ ] Custom fields?
- [ ] **What is the exact JSON format your CRM expects?**
  - Example format: `{ "email": "...", "firstname": "...", "lastname": "..." }`
  - Example format: `{ "properties": { "email": "...", "firstname": "..." } }`

### Step 3: Verify Social Media API Access
- [ ] **Instagram:**
  - [ ] Do you have `INSTAGRAM_ACCESS_TOKEN` in Supabase Secrets?
  - [ ] Is your Instagram account a Business Account?
  - [ ] Is it connected to a Facebook Page?
- [ ] **Facebook:**
  - [ ] Do you have `FACEBOOK_ACCESS_TOKEN` in Supabase Secrets?
  - [ ] Does your token have `pages_read_engagement` permission?
- [ ] **YouTube:**
  - [ ] Do you have `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`?
  - [ ] Does your token have `youtube.readonly` scope?

---

## 🗄️ DATABASE SETUP

### Step 4: Create Database Tables

#### 4.1: Create Leads Table
- [ ] Create new migration file: `supabase/migrations/XXXXXX_create_leads_table.sql`
- [ ] Add this SQL:

```sql
-- Create leads table to store engagement data before syncing to CRM
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  engagement_type TEXT NOT NULL, -- 'like', 'comment', 'share'
  user_identifier TEXT, -- username, user_id, channel_id, etc.
  user_name TEXT,
  user_profile_url TEXT,
  engagement_data JSONB, -- Store full API response
  engagement_text TEXT, -- For comments: the comment text
  crm_synced BOOLEAN DEFAULT false,
  crm_contact_id TEXT, -- ID returned from CRM after sync
  crm_sync_error TEXT, -- Error message if sync failed
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_leads_content_id ON public.leads(content_id);
CREATE INDEX idx_leads_crm_synced ON public.leads(crm_synced);
CREATE INDEX idx_leads_platform ON public.leads(platform);
CREATE INDEX idx_leads_post_id ON public.leads(post_id);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view leads from their content"
ON public.leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.content
    WHERE content.id = leads.content_id
    AND content.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all leads"
ON public.leads FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage all leads"
ON public.leads FOR ALL
USING (true)
WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] Run migration: `supabase db push` or deploy via Supabase Dashboard

#### 4.2: Create CRM Settings Table
- [ ] Create new migration file: `supabase/migrations/XXXXXX_create_crm_settings.sql`
- [ ] Add this SQL:

```sql
-- Create CRM settings table
CREATE TABLE public.crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  crm_type TEXT NOT NULL, -- 'hubspot', 'salesforce', 'pipedrive', 'custom'
  api_endpoint TEXT NOT NULL, -- Full URL to create contacts/leads
  auth_type TEXT NOT NULL, -- 'api_key', 'bearer_token', 'basic_auth'
  auth_header_name TEXT, -- e.g., 'X-API-Key', 'Authorization'
  field_mapping JSONB NOT NULL, -- Map social fields to CRM fields
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own CRM settings"
ON public.crm_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own CRM settings"
ON public.crm_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CRM settings"
ON public.crm_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all CRM settings"
ON public.crm_settings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create updated_at trigger
CREATE TRIGGER update_crm_settings_updated_at
BEFORE UPDATE ON public.crm_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] Run migration

---

## 🔧 EDGE FUNCTION: Fetch Engagement Data

### Step 5: Create `fetch-engagement` Edge Function

#### 5.1: Create Function File
- [ ] Create folder: `supabase/functions/fetch-engagement/`
- [ ] Create file: `supabase/functions/fetch-engagement/index.ts`

#### 5.2: Implement Instagram Engagement Fetching
- [ ] Add function to fetch Instagram comments:

```typescript
async function fetchInstagramComments(postId: string, accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}/comments?fields=id,text,username,timestamp,like_count&access_token=${accessToken}`
  );
  const data = await response.json();
  return data.data || [];
}
```

- [ ] Add function to fetch Instagram likes:

```typescript
async function fetchInstagramLikes(postId: string, accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${postId}/likes?fields=id,username&access_token=${accessToken}`
  );
  const data = await response.json();
  return data.data || [];
}
```

#### 5.3: Implement Facebook Engagement Fetching
- [ ] Add function to fetch Facebook comments
- [ ] Add function to fetch Facebook likes/reactions
- [ ] Add function to fetch Facebook shares (if available)

#### 5.4: Implement YouTube Engagement Fetching
- [ ] Add function to fetch YouTube comments
- [ ] Add function to fetch YouTube likes (channel info)

#### 5.5: Store Engagement in Database
- [ ] For each engagement, insert into `leads` table
- [ ] Store user identifier, name, engagement type, engagement text
- [ ] Store full API response in `engagement_data` JSONB field

#### 5.6: Test the Function
- [ ] Deploy function: `supabase functions deploy fetch-engagement`
- [ ] Test with a published post ID
- [ ] Verify data is stored in `leads` table

---

## 🔗 EDGE FUNCTION: Sync to CRM

### Step 6: Create `sync-to-crm` Edge Function

#### 6.1: Create Function File
- [ ] Create folder: `supabase/functions/sync-to-crm/`
- [ ] Create file: `supabase/functions/sync-to-crm/index.ts`

#### 6.2: Get CRM Settings
- [ ] Fetch CRM settings from database for the user
- [ ] Get API endpoint, auth type, field mapping

#### 6.3: Get Unsynced Leads
- [ ] Query `leads` table where `crm_synced = false`
- [ ] Filter by user or content

#### 6.4: Map Social Data to CRM Format
- [ ] For each lead, map fields according to `field_mapping`:
  - Map `user_identifier` → CRM email field (or username@social.unknown)
  - Map `user_name` → CRM first_name/last_name fields
  - Map `engagement_text` → CRM notes/description field
  - Map `platform` + `engagement_type` → CRM source field

#### 6.5: Send to CRM API
- [ ] Build HTTP request based on CRM settings:
  - Use correct auth header (API key, Bearer token, etc.)
  - Format JSON body according to CRM requirements
  - Send POST request to CRM endpoint

#### 6.6: Handle CRM Response
- [ ] If successful:
  - Update `leads` table: set `crm_synced = true`, store `crm_contact_id`
  - Set `synced_at` timestamp
- [ ] If failed:
  - Store error in `crm_sync_error`
  - Log error for debugging

#### 6.7: Add Error Handling
- [ ] Handle network errors
- [ ] Handle API errors (401, 403, 404, 500)
- [ ] Implement retry logic for transient failures
- [ ] Rate limiting (don't overwhelm CRM API)

#### 6.8: Test the Function
- [ ] Deploy function: `supabase functions deploy sync-to-crm`
- [ ] Test with sample lead data
- [ ] Verify lead is created in your CRM
- [ ] Verify `leads` table is updated

---

## 🔐 SECURITY: Store CRM Credentials

### Step 7: Store CRM API Key in Supabase Secrets

#### 7.1: Add CRM API Key to Secrets
- [ ] Go to Supabase Dashboard → Settings → Edge Functions → Secrets
- [ ] Add secret: `CRM_API_KEY` (or your CRM's key name)
- [ ] Add secret value (your actual API key/token)

#### 7.2: Update Edge Function to Use Secret
- [ ] In `sync-to-crm/index.ts`, read from environment:
  ```typescript
  const crmApiKey = Deno.env.get("CRM_API_KEY");
  ```
- [ ] Use this key in API requests

**Note:** For user-specific CRM settings, store in `crm_settings` table (encrypted if possible)

---

## 🎨 UI: CRM Settings Page

### Step 8: Create CRM Settings Page

#### 8.1: Create Page Component
- [ ] Create file: `src/pages/CRMSettingsPage.tsx`
- [ ] Add route in your router (if using React Router)

#### 8.2: Create Form
- [ ] Form fields:
  - [ ] CRM Type (dropdown: HubSpot, Salesforce, Pipedrive, Custom)
  - [ ] API Endpoint URL (text input)
  - [ ] Authentication Type (dropdown: API Key, Bearer Token, Basic Auth)
  - [ ] Auth Header Name (text input, e.g., "X-API-Key")
  - [ ] API Key/Token (password input)
  - [ ] Field Mapping (JSON editor or form fields)

#### 8.3: Field Mapping UI
- [ ] Create mapping interface:
  - [ ] Social Media Field → CRM Field
  - [ ] Example: "Username" → "Email"
  - [ ] Example: "User Name" → "First Name"
  - [ ] Example: "Comment Text" → "Notes"

#### 8.4: Save Settings
- [ ] On form submit:
  - [ ] Save to `crm_settings` table
  - [ ] Show success/error message
  - [ ] Optionally test connection to CRM

#### 8.5: Test Connection Button
- [ ] Add "Test Connection" button
- [ ] Make test API call to CRM
- [ ] Show success/error result

---

## 🎨 UI: Sync Leads Button

### Step 9: Add Sync Functionality to Analytics Page

#### 9.1: Add "Sync Leads to CRM" Button
- [ ] Open `src/pages/AnalyticsPage.tsx`
- [ ] Add button next to "Refresh All Analytics"
- [ ] Button text: "Sync Leads to CRM"

#### 9.2: Create Sync Function
- [ ] Create function `syncLeadsToCRM`:
  - [ ] Call `sync-to-crm` edge function
  - [ ] Show loading state
  - [ ] Show success/error message
  - [ ] Refresh leads data

#### 9.3: Add Leads Display
- [ ] Show count of unsynced leads
- [ ] Show count of synced leads
- [ ] Display list of recent leads (optional)

---

## 🔄 AUTOMATION: Scheduled Sync

### Step 10: Set Up Automated Syncing

#### 10.1: Option A - Supabase Cron Job (pg_cron)
- [ ] Create migration: `supabase/migrations/XXXXXX_create_crm_sync_cron.sql`
- [ ] Add SQL:

```sql
-- Schedule CRM sync to run every hour
SELECT cron.schedule(
  'sync-leads-to-crm',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-to-crm',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] Replace `YOUR_PROJECT` and `YOUR_SERVICE_ROLE_KEY` with actual values
- [ ] Run migration

#### 10.2: Option B - Manual Trigger (Simpler)
- [ ] Skip automation for now
- [ ] Use manual "Sync" button only
- [ ] Add automation later if needed

---

## 🧪 TESTING

### Step 11: Test End-to-End Flow

#### 11.1: Test Engagement Fetching
- [ ] Publish a test post to Instagram/Facebook/YouTube
- [ ] Get some real engagement (likes, comments)
- [ ] Call `fetch-engagement` function with post ID
- [ ] Verify leads are created in `leads` table
- [ ] Check that user data is captured correctly

#### 11.2: Test CRM Sync
- [ ] Configure CRM settings in UI
- [ ] Test connection to CRM
- [ ] Manually trigger sync
- [ ] Verify lead is created in your CRM
- [ ] Verify `leads` table shows `crm_synced = true`

#### 11.3: Test Error Handling
- [ ] Test with invalid CRM API key
- [ ] Test with invalid CRM endpoint
- [ ] Test with network failure
- [ ] Verify errors are handled gracefully

#### 11.4: Test Multiple Platforms
- [ ] Test Instagram engagement → CRM
- [ ] Test Facebook engagement → CRM
- [ ] Test YouTube engagement → CRM

---

## 📊 MONITORING

### Step 12: Add Logging & Monitoring

#### 12.1: Add Logging to Functions
- [ ] Add console.log for key operations:
  - [ ] When fetching engagement
  - [ ] When syncing to CRM
  - [ ] When errors occur
- [ ] Log counts: leads fetched, leads synced, errors

#### 12.2: View Logs
- [ ] Go to Supabase Dashboard → Edge Functions → Logs
- [ ] Monitor function executions
- [ ] Check for errors

#### 12.3: Create Dashboard Query (Optional)
- [ ] Create SQL view to show:
  - [ ] Total leads captured
  - [ ] Total leads synced
  - [ ] Sync success rate
  - [ ] Recent sync errors

---

## 🎯 FINAL CHECKLIST

### Before Going Live:
- [ ] All database tables created and migrated
- [ ] All edge functions deployed
- [ ] CRM settings configured in UI
- [ ] CRM API credentials stored securely
- [ ] Tested with real social media posts
- [ ] Tested with real CRM
- [ ] Error handling works
- [ ] Logging is in place
- [ ] UI is user-friendly
- [ ] Documentation updated

---

## 🚀 QUICK START PATH (If You Want to Start Fast)

**Skip to the essentials:**

1. ✅ **Step 1-3:** Gather CRM info (30 min)
2. ✅ **Step 4:** Create `leads` table only (1 hour)
3. ✅ **Step 5:** Create `fetch-engagement` for Instagram only (3 hours)
4. ✅ **Step 6:** Create `sync-to-crm` function (4 hours)
5. ✅ **Step 7:** Add CRM API key to Supabase Secrets (5 min)
6. ✅ **Step 9:** Add manual sync button (1 hour)
7. ✅ **Step 11:** Test end-to-end (1 hour)

**Total: ~10-11 hours for basic working integration**

Then add:
- UI settings page (Step 8)
- Other platforms (Step 5.3-5.4)
- Automation (Step 10)
- Monitoring (Step 12)

---

## 📝 NOTES

- **Start with one platform** (Instagram is easiest)
- **Test manually first** before adding automation
- **Store CRM credentials securely** (Supabase Secrets)
- **Handle errors gracefully** (users shouldn't see technical errors)
- **Log everything** (helps with debugging)

---

**Ready to start? Begin with Step 1!** 🚀
