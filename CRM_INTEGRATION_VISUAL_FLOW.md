# CRM Integration - Visual Flow & Architecture

## 🔄 Complete Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT FLOW PLATFORM                        │
│                                                                 │
│  1. User publishes content to social media                      │
│     ↓                                                            │
│  2. Content stored in 'content' table with social_post_id       │
│     ↓                                                            │
│  3. User clicks "Sync Leads" or automated cron runs              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION: fetch-engagement                     │
│                                                                 │
│  For each published post:                                       │
│  • Fetch comments from Instagram/Facebook/YouTube API          │
│  • Fetch likes/reactions from APIs                             │
│  • Extract user information (username, name, profile)         │
│  • Store in 'leads' table                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE: leads table                        │
│                                                                 │
│  • content_id (which post)                                      │
│  • platform (instagram/facebook/youtube)                        │
│  • engagement_type (like/comment/share)                         │
│  • user_identifier (username/channel_id)                       │
│  • user_name, user_profile_url                                  │
│  • engagement_text (comment text)                               │
│  • crm_synced = false (not synced yet)                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION: sync-to-crm                         │
│                                                                 │
│  1. Get CRM settings from 'crm_settings' table                 │
│     • API endpoint URL                                          │
│     • Authentication method                                     │
│     • Field mapping (social → CRM fields)                      │
│                                                                 │
│  2. Get unsynced leads (crm_synced = false)                    │
│                                                                 │
│  3. For each lead:                                              │
│     • Map social data to CRM format                             │
│     • Build HTTP request with auth                              │
│     • Send POST to CRM API                                      │
│     • Update lead: crm_synced = true                           │
│     • Store CRM contact ID                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      YOUR CRM PLATFORM                          │
│                                                                 │
│  • Receives lead data                                           │
│  • Creates contact/lead record                                  │
│  • Returns contact ID                                           │
│  • Lead is now in your CRM! ✅                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure You'll Create

```
your-project/
├── supabase/
│   ├── functions/
│   │   ├── fetch-engagement/          ← NEW
│   │   │   └── index.ts
│   │   └── sync-to-crm/              ← NEW
│   │       └── index.ts
│   └── migrations/
│       ├── XXXXXX_create_leads_table.sql        ← NEW
│       └── XXXXXX_create_crm_settings.sql      ← NEW
│
└── src/
    ├── pages/
    │   ├── CRMSettingsPage.tsx        ← NEW
    │   └── AnalyticsPage.tsx          ← MODIFY (add sync button)
    └── hooks/
        └── useCRM.tsx                 ← NEW (optional)
```

---

## 🗄️ Database Schema

### `leads` Table
```sql
leads
├── id (UUID, Primary Key)
├── content_id (UUID, Foreign Key → content.id)
├── platform (TEXT) - 'instagram', 'facebook', 'youtube'
├── post_id (TEXT) - Social media post ID
├── engagement_type (TEXT) - 'like', 'comment', 'share'
├── user_identifier (TEXT) - Username, user_id, channel_id
├── user_name (TEXT) - Display name
├── user_profile_url (TEXT) - Profile link
├── engagement_data (JSONB) - Full API response
├── engagement_text (TEXT) - Comment text (if comment)
├── crm_synced (BOOLEAN) - Has it been sent to CRM?
├── crm_contact_id (TEXT) - ID returned from CRM
├── crm_sync_error (TEXT) - Error if sync failed
├── synced_at (TIMESTAMPTZ) - When synced
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### `crm_settings` Table
```sql
crm_settings
├── id (UUID, Primary Key)
├── user_id (UUID, Foreign Key → auth.users.id)
├── crm_type (TEXT) - 'hubspot', 'salesforce', 'custom'
├── api_endpoint (TEXT) - Full URL to create contacts
├── auth_type (TEXT) - 'api_key', 'bearer_token'
├── auth_header_name (TEXT) - 'X-API-Key', 'Authorization'
├── field_mapping (JSONB) - Field mapping configuration
├── is_active (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

---

## 🔌 API Integration Points

### 1. Social Media APIs (Fetch Engagement)

**Instagram:**
```
GET https://graph.facebook.com/v18.0/{post-id}/comments
GET https://graph.facebook.com/v18.0/{post-id}/likes
```

**Facebook:**
```
GET https://graph.facebook.com/v18.0/{post-id}/comments
GET https://graph.facebook.com/v18.0/{post-id}/likes
GET https://graph.facebook.com/v18.0/{post-id}/reactions
```

**YouTube:**
```
GET https://www.googleapis.com/youtube/v3/commentThreads?videoId={video-id}
```

### 2. Your CRM API (Create Lead)

**Example - HubSpot:**
```
POST https://api.hubapi.com/crm/v3/objects/contacts
Headers:
  Authorization: Bearer {api-key}
  Content-Type: application/json
Body:
{
  "properties": {
    "email": "username@social.unknown",
    "firstname": "John",
    "lastname": "Doe",
    "source": "Social Media - Instagram"
  }
}
```

**Example - Custom CRM:**
```
POST https://your-crm.com/api/v1/leads
Headers:
  X-API-Key: {your-api-key}
  Content-Type: application/json
Body:
{
  "email": "username@social.unknown",
  "first_name": "John",
  "last_name": "Doe",
  "source": "Instagram Comment"
}
```

---

## 🎯 Data Flow Example

### Example: Instagram Comment → CRM

**1. User comments on Instagram post:**
```
Post ID: 123456789
Comment: "Love this! How can I learn more?"
Username: @johndoe
```

**2. fetch-engagement function:**
```typescript
// Fetches from Instagram API
const comments = await fetchInstagramComments('123456789', accessToken);

// Stores in database
INSERT INTO leads (
  content_id: 'content-uuid',
  platform: 'instagram',
  post_id: '123456789',
  engagement_type: 'comment',
  user_identifier: 'johndoe',
  user_name: 'John Doe',
  engagement_text: 'Love this! How can I learn more?',
  crm_synced: false
);
```

**3. sync-to-crm function:**
```typescript
// Maps to CRM format
const crmData = {
  email: 'johndoe@social.unknown',  // or lookup if available
  firstname: 'John',
  lastname: 'Doe',
  source: 'Social Media - Instagram',
  notes: 'Engaged via comment on post: 123456789'
};

// Sends to CRM
POST https://your-crm.com/api/leads
Body: crmData

// Updates database
UPDATE leads SET 
  crm_synced = true,
  crm_contact_id = 'crm-contact-123',
  synced_at = NOW()
WHERE id = 'lead-uuid';
```

**4. Lead is now in your CRM! ✅**

---

## 🔐 Security Flow

```
┌─────────────────┐
│  User Configures│
│  CRM Settings   │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Store in       │
│  crm_settings   │
│  table          │
└────────┬────────┘
         ↓
┌─────────────────┐
│  API Key stored │
│  in Supabase    │
│  Secrets        │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Edge Function  │
│  reads from     │
│  Secrets        │
└────────┬────────┘
         ↓
┌─────────────────┐
│  Makes secure   │
│  API call to    │
│  CRM            │
└─────────────────┘
```

---

## ⚡ Quick Start Flow (MVP)

```
Day 1:
├── Step 1-3: Gather CRM info (30 min)
├── Step 4: Create leads table (1 hour)
└── Step 5: Create fetch-engagement (Instagram only) (3 hours)

Day 2:
├── Step 6: Create sync-to-crm (4 hours)
├── Step 7: Add API key to Secrets (5 min)
├── Step 9: Add sync button (1 hour)
└── Step 11: Test everything (1 hour)

Result: Working integration! ✅
```

---

## 📊 Success Metrics

You'll know it's working when:

1. ✅ Engagement data appears in `leads` table
2. ✅ Leads are created in your CRM
3. ✅ `crm_synced` flag is `true` in database
4. ✅ `crm_contact_id` is stored
5. ✅ No errors in Supabase logs
6. ✅ UI shows sync status

---

**Follow the step-by-step checklist in `CRM_INTEGRATION_STEP_BY_STEP_CHECKLIST.md`!** 🚀
