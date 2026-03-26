# CRM Integration Guide - Baby Steps

## 📋 Overview

This guide explains how to connect your Content Flow platform to your separate CRM system to automatically capture leads from social media engagement (likes, shares, comments, etc.).

**Current Platform Capabilities:**
- ✅ Posts content to: Instagram, Facebook, YouTube
- ✅ Fetches aggregate analytics: likes_count, comments_count, shares_count, reach_count
- ✅ Stores post IDs (social_post_id) for each published content

**What's Missing for Lead Capture:**
- ❌ Individual user data (who liked/commented/shared)
- ❌ User contact information (email, name, profile links)
- ❌ Real-time webhook notifications for engagement
- ❌ CRM API integration

---

## 🏗️ Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Content Flow    │────────▶│  Social Media    │────────▶│  Your CRM   │
│  Platform       │  Posts   │  Platforms       │  Leads  │  Platform   │
│                 │          │                  │         │             │
│  - Post Content │          │  - Instagram     │         │  - Store    │
│  - Track Posts  │          │  - Facebook      │         │    Leads    │
│  - Get Post IDs │          │  - YouTube       │         │  - Contact  │
└─────────────────┘          └──────────────────┘         └─────────────┘
       │                              │
       │                              │
       └────────── Webhooks ──────────┘
              (Real-time events)
```

**Two Main Approaches:**

### Approach 1: Webhook-Based (Real-time) ⚡
- Social platforms send webhooks when users engage
- Your platform receives webhooks → processes → sends to CRM
- **Best for:** Real-time lead capture, immediate notifications

### Approach 2: Polling-Based (Scheduled) 🔄
- Periodically fetch engagement data from social APIs
- Extract user information from likes/comments/shares
- Send to CRM in batches
- **Best for:** Simpler setup, less real-time critical

---

## 📊 What Data Can Be Captured?

### Instagram
- ✅ **Likes:** User profile info (username, profile picture URL)
- ✅ **Comments:** Comment text, username, timestamp
- ❌ **Shares:** Limited (Instagram doesn't expose share data via API)
- ⚠️ **Limitations:** Instagram Graph API requires Business Account, some user data may be limited

### Facebook
- ✅ **Likes/Reactions:** User name, profile link (if public)
- ✅ **Comments:** Comment text, user name, timestamp
- ✅ **Shares:** User who shared (if public)
- ⚠️ **Limitations:** Privacy settings may limit data access

### YouTube
- ✅ **Likes:** User channel info (channel name, channel ID)
- ✅ **Comments:** Comment text, author name, timestamp
- ❌ **Shares:** Not available via API
- ✅ **Subscribers:** Can track new subscribers from your channel

---

## 🎯 Step-by-Step Implementation Plan

### **PHASE 1: Understanding & Planning** (Difficulty: ⭐ Easy)

#### Step 1.1: Identify Your CRM Platform
- [ ] What CRM are you using? (HubSpot, Salesforce, Pipedrive, custom, etc.)
- [ ] Does your CRM have a REST API?
- [ ] What authentication method does it use? (API Key, OAuth, Bearer Token)
- [ ] What's the endpoint URL for creating leads/contacts?

**Difficulty:** ⭐ Easy (just documentation review)

---

#### Step 1.2: Map CRM Fields
- [ ] What fields does your CRM need for a lead?
  - Example: `email`, `first_name`, `last_name`, `phone`, `company`, `source`, `notes`
- [ ] Map social media data to CRM fields:
  - Instagram username → CRM field?
  - Comment text → CRM notes field?
  - Engagement type (like/comment/share) → CRM source field?

**Difficulty:** ⭐ Easy (planning/documentation)

---

#### Step 1.3: Review Social Media API Access
- [ ] **Instagram:** Do you have Instagram Business Account connected to Facebook Page?
- [ ] **Facebook:** Do you have Facebook Page access token with `pages_read_engagement` permission?
- [ ] **YouTube:** Do you have YouTube Data API v3 access with `youtube.readonly` scope?

**Difficulty:** ⭐⭐ Medium (requires checking API permissions)

---

### **PHASE 2: Database Setup** (Difficulty: ⭐⭐ Medium)

#### Step 2.1: Create Leads Table (Optional - for intermediate storage)
```sql
-- Store leads before sending to CRM
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id),
  platform TEXT NOT NULL,
  post_id TEXT NOT NULL,
  engagement_type TEXT NOT NULL, -- 'like', 'comment', 'share'
  user_identifier TEXT, -- username, user_id, etc.
  user_name TEXT,
  user_profile_url TEXT,
  engagement_data JSONB, -- Store full API response
  crm_synced BOOLEAN DEFAULT false,
  crm_contact_id TEXT, -- ID returned from CRM
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Difficulty:** ⭐⭐ Medium (SQL knowledge required)

---

#### Step 2.2: Create CRM Configuration Table
```sql
-- Store CRM API credentials and settings
CREATE TABLE public.crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  crm_type TEXT NOT NULL, -- 'hubspot', 'salesforce', 'custom', etc.
  api_endpoint TEXT NOT NULL,
  api_key TEXT, -- Encrypted in production
  auth_token TEXT, -- Encrypted in production
  field_mapping JSONB, -- Map social fields to CRM fields
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Difficulty:** ⭐⭐ Medium (SQL + security considerations)

---

### **PHASE 3: Social Media API Integration** (Difficulty: ⭐⭐⭐ Hard)

#### Step 3.1: Create Edge Function to Fetch Engagement Data

**File:** `supabase/functions/fetch-engagement/index.ts`

**What it does:**
- Fetches likes, comments, shares for a specific post
- Extracts user information from each engagement
- Returns structured data ready for CRM

**Key API Endpoints Needed:**

**Instagram:**
```
GET /{ig-media-id}/comments
GET /{ig-media-id}/likes
```

**Facebook:**
```
GET /{post-id}/comments
GET /{post-id}/likes
GET /{post-id}/reactions
```

**YouTube:**
```
GET /commentThreads?videoId={video-id}
GET /videos?part=statistics&id={video-id}
```

**Difficulty:** ⭐⭐⭐ Hard
- Requires understanding of each platform's API
- Different data structures per platform
- Rate limiting considerations
- Error handling for privacy-restricted data

---

#### Step 3.2: Handle Webhooks (Optional - Advanced)

**File:** `supabase/functions/webhook-handler/index.ts`

**What it does:**
- Receives webhooks from social platforms
- Validates webhook signatures
- Processes real-time engagement events
- Triggers CRM sync

**Setup Required:**
- Configure webhook URLs in Facebook/Instagram Developer Portal
- Set up webhook verification
- Handle different event types

**Difficulty:** ⭐⭐⭐⭐ Very Hard
- Complex webhook verification
- Real-time processing
- Multiple event types to handle
- Security considerations

---

### **PHASE 4: CRM Integration** (Difficulty: ⭐⭐⭐ Hard)

#### Step 4.1: Create CRM Client Function

**File:** `supabase/functions/sync-to-crm/index.ts`

**What it does:**
- Takes engagement data
- Formats according to CRM field mapping
- Sends HTTP request to CRM API
- Handles authentication
- Stores sync status

**Example for HubSpot:**
```typescript
async function syncToHubSpot(leadData: any, apiKey: string) {
  const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        email: leadData.email,
        firstname: leadData.firstName,
        lastname: leadData.lastName,
        // ... other fields
      }
    })
  });
  return response.json();
}
```

**Difficulty:** ⭐⭐⭐ Hard
- Different API formats per CRM
- Authentication handling
- Error handling and retries
- Rate limiting from CRM side

---

#### Step 4.2: Create Field Mapping Logic

**What it does:**
- Maps social media user data to CRM fields
- Handles missing data gracefully
- Applies transformations (e.g., username → email lookup)

**Example:**
```typescript
function mapToCRMFields(engagement: any, mapping: any) {
  return {
    [mapping.email]: engagement.user_email || `${engagement.username}@social.unknown`,
    [mapping.firstName]: engagement.user_name?.split(' ')[0] || '',
    [mapping.lastName]: engagement.user_name?.split(' ').slice(1).join(' ') || '',
    [mapping.source]: `Social Media - ${engagement.platform}`,
    [mapping.notes]: `Engaged via ${engagement.type} on post: ${engagement.post_id}`
  };
}
```

**Difficulty:** ⭐⭐ Medium
- Data transformation logic
- Handling edge cases

---

### **PHASE 5: Automation & Scheduling** (Difficulty: ⭐⭐ Medium)

#### Step 5.1: Create Scheduled Job

**Option A: Supabase Cron Jobs (pg_cron)**
```sql
-- Run every hour to fetch engagement and sync to CRM
SELECT cron.schedule(
  'sync-engagement-to-crm',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/sync-engagement',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

**Option B: Edge Function Scheduler**
- Use Supabase Edge Functions with scheduled triggers
- Or external cron service (cron-job.org, etc.)

**Difficulty:** ⭐⭐ Medium
- Setting up cron jobs
- Error handling and monitoring

---

#### Step 5.2: Create Manual Sync Trigger

**What it does:**
- Button in UI to manually sync engagement for a post
- Useful for testing and on-demand syncing

**File:** `src/hooks/useCRM.tsx` (new hook)

**Difficulty:** ⭐ Easy
- Simple API call from frontend

---

### **PHASE 6: UI Integration** (Difficulty: ⭐⭐ Medium)

#### Step 6.1: Add CRM Settings Page

**File:** `src/pages/CRMSettingsPage.tsx` (new page)

**Features:**
- Configure CRM API endpoint
- Enter API credentials
- Map fields
- Test connection
- View sync status

**Difficulty:** ⭐⭐ Medium
- Form handling
- API integration
- Security (credential storage)

---

#### Step 6.2: Add Lead View in Analytics

**File:** Modify `src/pages/AnalyticsPage.tsx`

**Features:**
- Show "Leads Captured" count
- List of leads from each post
- Filter by platform, engagement type
- Link to CRM contact

**Difficulty:** ⭐⭐ Medium
- UI components
- Data fetching and display

---

## 🔐 Security Considerations

### Step 7.1: Secure API Credentials
- [ ] Store CRM API keys in Supabase Secrets (not in database)
- [ ] Use environment variables for sensitive data
- [ ] Encrypt credentials at rest
- [ ] Implement credential rotation

**Difficulty:** ⭐⭐⭐ Hard
- Security best practices
- Encryption implementation

---

### Step 7.2: Webhook Security
- [ ] Verify webhook signatures from social platforms
- [ ] Use HTTPS only
- [ ] Implement rate limiting
- [ ] Validate request sources

**Difficulty:** ⭐⭐⭐ Hard
- Cryptographic verification
- Security protocols

---

## 📝 Data Privacy & Compliance

### Step 8.1: GDPR/Privacy Compliance
- [ ] User consent for data collection
- [ ] Right to deletion
- [ ] Data anonymization options
- [ ] Privacy policy updates

**Difficulty:** ⭐⭐⭐ Hard
- Legal compliance
- Data handling procedures

---

## 🧪 Testing Strategy

### Step 9.1: Test Each Component
- [ ] Test Instagram API engagement fetch
- [ ] Test Facebook API engagement fetch
- [ ] Test YouTube API engagement fetch
- [ ] Test CRM API integration
- [ ] Test end-to-end flow
- [ ] Test error handling

**Difficulty:** ⭐⭐ Medium
- API testing
- Integration testing

---

## 📈 Monitoring & Maintenance

### Step 10.1: Add Logging
- [ ] Log all API calls
- [ ] Log sync successes/failures
- [ ] Monitor rate limits
- [ ] Track error rates

**Difficulty:** ⭐⭐ Medium
- Logging implementation
- Monitoring setup

---

## 🎯 Difficulty Summary

| Phase | Step | Difficulty | Estimated Time |
|-------|------|------------|----------------|
| 1 | Planning & Setup | ⭐ Easy | 2-4 hours |
| 2 | Database Setup | ⭐⭐ Medium | 4-8 hours |
| 3 | Social API Integration | ⭐⭐⭐ Hard | 16-24 hours |
| 4 | CRM Integration | ⭐⭐⭐ Hard | 16-24 hours |
| 5 | Automation | ⭐⭐ Medium | 8-12 hours |
| 6 | UI Integration | ⭐⭐ Medium | 12-16 hours |
| 7 | Security | ⭐⭐⭐ Hard | 8-16 hours |
| 8 | Compliance | ⭐⭐⭐ Hard | 8-16 hours |
| 9 | Testing | ⭐⭐ Medium | 8-12 hours |
| 10 | Monitoring | ⭐⭐ Medium | 4-8 hours |

**Total Estimated Time:** 90-140 hours (2-3.5 weeks for experienced developer)

---

## 🚀 Quick Start Recommendations

### **Start Small:**
1. **Week 1:** Set up database tables and CRM API connection (Phase 1-2, 4.1)
2. **Week 2:** Implement engagement fetching for ONE platform (Instagram) (Phase 3.1)
3. **Week 3:** Connect to CRM and test end-to-end (Phase 4)
4. **Week 4:** Add other platforms and UI (Phase 3, 6)

### **MVP (Minimum Viable Product):**
- ✅ Fetch comments from Instagram posts
- ✅ Extract username and comment text
- ✅ Send to CRM as leads
- ✅ Manual sync button (no automation yet)

---

## 📚 Required Knowledge/Skills

### Essential:
- ✅ TypeScript/JavaScript
- ✅ REST API understanding
- ✅ Supabase Edge Functions
- ✅ SQL (PostgreSQL)
- ✅ React (for UI)

### Helpful:
- ✅ OAuth/API authentication
- ✅ Webhook handling
- ✅ Data transformation
- ✅ Error handling patterns
- ✅ Security best practices

---

## 🔗 Key Resources

### Social Media APIs:
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Facebook Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)

### CRM APIs (Examples):
- [HubSpot API](https://developers.hubspot.com/docs/api/overview)
- [Salesforce API](https://developer.salesforce.com/docs/apis)
- [Pipedrive API](https://developers.pipedrive.com/docs/api/v1)

### Supabase:
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Database Functions](https://supabase.com/docs/guides/database/functions)

---

## ⚠️ Important Limitations

### Instagram:
- ❌ Cannot get email addresses directly
- ❌ Limited user profile data (privacy restrictions)
- ✅ Can get username, profile picture, comment text

### Facebook:
- ⚠️ User data depends on privacy settings
- ⚠️ May need user consent for some data
- ✅ Better data access than Instagram

### YouTube:
- ✅ Can get channel information
- ✅ Can get comment author details
- ❌ Limited personal information

### General:
- ⚠️ Rate limits on all platforms
- ⚠️ API changes may break integration
- ⚠️ Privacy regulations (GDPR, CCPA)

---

## 🎬 Next Steps

1. **Decide on your CRM platform** and get API credentials
2. **Review this guide** and identify which phases you'll implement
3. **Start with Phase 1** - planning and setup
4. **Test with one platform first** (recommend Instagram or Facebook)
5. **Iterate and expand** to other platforms

---

## 💡 Pro Tips

1. **Start with Comments Only:** Comments usually have the most valuable lead data
2. **Use Webhooks if Possible:** Real-time is better than polling
3. **Store Raw Data:** Keep original API responses for debugging
4. **Implement Retry Logic:** API calls can fail, retry with exponential backoff
5. **Monitor Rate Limits:** Each platform has different limits
6. **Test with Test Accounts:** Don't test on production posts initially

---

**Ready to start? Begin with Phase 1, Step 1.1!** 🚀
