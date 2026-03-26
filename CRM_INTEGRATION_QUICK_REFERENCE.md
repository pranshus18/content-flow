# CRM Integration - Quick Reference Checklist

## 📋 Everything You Need to Do (Condensed List)

### **PHASE 1: Planning** ⭐ Easy
- [ ] Identify your CRM platform (HubSpot, Salesforce, Pipedrive, custom)
- [ ] Get CRM API credentials (API key, endpoint URL)
- [ ] Map social media data fields to CRM fields
- [ ] Verify social media API access (Instagram Business, Facebook Page, YouTube)

### **PHASE 2: Database** ⭐⭐ Medium
- [ ] Create `leads` table (store engagement data)
- [ ] Create `crm_settings` table (store CRM config)
- [ ] Set up RLS policies for security

### **PHASE 3: Social Media APIs** ⭐⭐⭐ Hard
- [ ] Create `fetch-engagement` Edge Function
  - [ ] Instagram: Fetch comments & likes
  - [ ] Facebook: Fetch comments, likes, reactions
  - [ ] YouTube: Fetch comments
- [ ] Extract user information from API responses
- [ ] Handle rate limits and errors

### **PHASE 4: CRM Integration** ⭐⭐⭐ Hard
- [ ] Create `sync-to-crm` Edge Function
- [ ] Implement CRM API client (HTTP requests)
- [ ] Create field mapping logic
- [ ] Handle authentication (API keys, OAuth)
- [ ] Store sync status in database

### **PHASE 5: Automation** ⭐⭐ Medium
- [ ] Set up scheduled job (cron) to sync engagement
- [ ] Create manual sync trigger (button in UI)
- [ ] Add error handling and retries

### **PHASE 6: UI** ⭐⭐ Medium
- [ ] Create CRM Settings page
- [ ] Add "Sync Leads" button to Analytics page
- [ ] Display leads list with filters
- [ ] Show sync status

### **PHASE 7: Security** ⭐⭐⭐ Hard
- [ ] Store CRM credentials in Supabase Secrets
- [ ] Encrypt sensitive data
- [ ] Implement webhook signature verification (if using webhooks)

### **PHASE 8: Testing** ⭐⭐ Medium
- [ ] Test each platform's API integration
- [ ] Test CRM API connection
- [ ] Test end-to-end flow
- [ ] Test error scenarios

---

## 🎯 Difficulty Levels Summary

| Difficulty | What It Means | Examples |
|------------|---------------|----------|
| ⭐ Easy | Simple configuration, documentation review | Planning, UI buttons |
| ⭐⭐ Medium | Requires coding but straightforward | Database setup, UI components, scheduling |
| ⭐⭐⭐ Hard | Complex logic, API integration, security | Social API integration, CRM sync, webhooks |
| ⭐⭐⭐⭐ Very Hard | Advanced, requires deep expertise | Webhook verification, real-time processing |

---

## 📊 What Data You Can Capture

### Instagram
- ✅ Username
- ✅ Profile picture URL
- ✅ Comment text
- ✅ Timestamp
- ❌ Email (not available)
- ❌ Full name (limited)

### Facebook
- ✅ User name
- ✅ Profile link (if public)
- ✅ Comment text
- ✅ Reaction type
- ⚠️ Email (depends on privacy)

### YouTube
- ✅ Channel name
- ✅ Channel ID
- ✅ Comment text
- ✅ Timestamp
- ❌ Email (not available)

---

## 🔧 Technical Requirements

### Must Have:
- Supabase project (you have this ✅)
- CRM with REST API
- Social media API access tokens
- TypeScript/JavaScript knowledge
- SQL knowledge (basic)

### Nice to Have:
- Webhook support from CRM
- Real-time processing needs
- Advanced error handling
- Monitoring/logging tools

---

## ⏱️ Time Estimates

| Phase | Time Estimate |
|-------|---------------|
| Planning | 2-4 hours |
| Database Setup | 4-8 hours |
| Social API Integration | 16-24 hours |
| CRM Integration | 16-24 hours |
| Automation | 8-12 hours |
| UI Integration | 12-16 hours |
| Security | 8-16 hours |
| Testing | 8-12 hours |
| **Total** | **90-140 hours** |

---

## 🚀 Recommended Starting Order

1. **Day 1-2:** Phase 1 (Planning) + Phase 2 (Database)
2. **Day 3-5:** Phase 4 (CRM Integration) - Test with dummy data
3. **Day 6-10:** Phase 3 (Social APIs) - Start with Instagram only
4. **Day 11-12:** Connect Phase 3 + Phase 4 (end-to-end test)
5. **Day 13-15:** Phase 5 (Automation) + Phase 6 (UI)
6. **Day 16-18:** Phase 7 (Security) + Phase 8 (Testing)
7. **Day 19+:** Add other platforms, refine, monitor

---

## 📝 Key Files to Create

### New Edge Functions:
- `supabase/functions/fetch-engagement/index.ts`
- `supabase/functions/sync-to-crm/index.ts`
- `supabase/functions/webhook-handler/index.ts` (optional)

### New Database Tables:
- `public.leads`
- `public.crm_settings`

### New UI Components:
- `src/pages/CRMSettingsPage.tsx`
- `src/hooks/useCRM.tsx`
- Modify `src/pages/AnalyticsPage.tsx`

### New SQL Migrations:
- `supabase/migrations/XXXXXX_create_leads_table.sql`
- `supabase/migrations/XXXXXX_create_crm_settings.sql`

---

## ⚠️ Common Challenges

1. **Rate Limits:** Each platform has different limits
   - Solution: Implement rate limiting, caching, batching

2. **Privacy Restrictions:** Users may have private profiles
   - Solution: Handle gracefully, only capture public data

3. **API Changes:** Social platforms update APIs frequently
   - Solution: Version your API calls, monitor for deprecations

4. **Missing Data:** Not all users provide email/name
   - Solution: Use username as identifier, enrich later if possible

5. **CRM Field Mapping:** Different CRMs need different formats
   - Solution: Create flexible mapping configuration

---

## 🎯 MVP (Minimum Viable Product) Checklist

For a quick start, implement only:

- [ ] Database: `leads` table
- [ ] Edge Function: `fetch-engagement` (Instagram only)
- [ ] Edge Function: `sync-to-crm` (basic)
- [ ] Manual sync button in UI
- [ ] Test with one Instagram post

**Time:** ~40-60 hours (1-1.5 weeks)

---

## 📚 Key API Endpoints You'll Need

### Instagram:
```
GET /{ig-media-id}/comments
GET /{ig-media-id}/likes
```

### Facebook:
```
GET /{post-id}/comments
GET /{post-id}/likes
GET /{post-id}/reactions
```

### YouTube:
```
GET /commentThreads?videoId={video-id}
```

### CRM (Example - HubSpot):
```
POST /crm/v3/objects/contacts
```

---

## 🔐 Security Checklist

- [ ] Store API keys in Supabase Secrets (not database)
- [ ] Use HTTPS for all API calls
- [ ] Validate webhook signatures
- [ ] Implement rate limiting
- [ ] Encrypt sensitive data
- [ ] Use environment variables
- [ ] Regular credential rotation

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Engagement data is fetched from social platforms
2. ✅ User information is extracted correctly
3. ✅ Leads are created in your CRM
4. ✅ Sync status is tracked in database
5. ✅ UI shows leads and sync status
6. ✅ Errors are handled gracefully
7. ✅ Rate limits are respected

---

**See `CRM_INTEGRATION_GUIDE.md` for detailed step-by-step instructions!**
