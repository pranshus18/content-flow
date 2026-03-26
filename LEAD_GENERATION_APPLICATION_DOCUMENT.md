# Lead Generation Application - Complete Implementation Document

## 📋 Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Integration Points](#integration-points)
6. [Frontend Components](#frontend-components)
7. [Lead Capture Mechanisms](#lead-capture-mechanisms)
8. [Data Flow](#data-flow)
9. [CRM Export Functionality](#crm-export-functionality)
10. [Implementation Steps](#implementation-steps)
11. [Technical Requirements](#technical-requirements)

---

## 1. Overview

### 1.1 Purpose
The Lead Generation Application captures and manages potential leads from social media engagement. It automatically collects information about users who interact with your social media posts (likes, comments, views) and stores them in a structured format ready for CRM integration.

### 1.2 Objectives
- **Automatic Lead Capture**: Capture leads from Facebook, Instagram, and YouTube posts
- **Engagement Tracking**: Track viewers, likers, commenters, and sharers
- **Lead Enrichment**: Collect available user information from social platforms
- **Lead Management**: Organize, filter, and manage captured leads
- **CRM Ready**: Export leads in formats compatible with popular CRMs (Salesforce, HubSpot, etc.)

### 1.3 Key Features
- Real-time lead capture from published posts
- Lead deduplication and merging
- Lead scoring based on engagement level
- Lead status tracking (new, contacted, qualified, converted)
- Export to CSV/JSON for CRM import
- Lead analytics and insights
- Integration with existing content management system

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TypeScript)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Lead Manager │  │ Lead Analytics│  │ CRM Export   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Edge Functions                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ capture-leads    │  │ enrich-leads     │                │
│  │ (Scheduled Job)  │  │ (Background)      │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ export-leads     │  │ lead-analytics   │                │
│  │ (On Demand)      │  │ (On Demand)      │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Database (PostgreSQL)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   leads      │  │ lead_events  │  │ lead_scores  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         Social Media APIs (Facebook, Instagram, YouTube)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Overview

1. **Frontend**: React/TypeScript application with lead management interface
2. **Backend**: Supabase Edge Functions for lead capture and processing
3. **Database**: PostgreSQL tables for leads, events, and analytics
4. **Scheduler**: Cron job to periodically fetch new leads
5. **Integration**: Hooks into existing `fetch-analytics` and `publish-social` functions

---

## 3. Database Schema

### 3.1 Leads Table

```sql
-- Migration: 20260120000000_create_leads_table.sql

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
  
  -- Lead Identification
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'youtube')),
  platform_user_id TEXT NOT NULL, -- Social media user ID
  platform_username TEXT, -- Username if available
  platform_name TEXT, -- Display name
  
  -- Contact Information
  email TEXT,
  phone TEXT,
  profile_url TEXT, -- Link to social media profile
  
  -- Engagement Data
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('view', 'like', 'comment', 'share')),
  engagement_timestamp TIMESTAMPTZ NOT NULL,
  comment_text TEXT, -- If engagement_type is 'comment'
  
  -- Lead Metadata
  lead_score INTEGER DEFAULT 0, -- Calculated score (0-100)
  lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  lead_source TEXT DEFAULT 'social_media',
  tags TEXT[], -- Array of tags for categorization
  
  -- Enrichment Data
  enriched_data JSONB, -- Additional data from platform APIs
  last_enriched_at TIMESTAMPTZ,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(platform, platform_user_id, content_id, engagement_type, engagement_timestamp)
);

-- Indexes for performance
CREATE INDEX idx_leads_content_id ON public.leads(content_id);
CREATE INDEX idx_leads_platform ON public.leads(platform);
CREATE INDEX idx_leads_status ON public.leads(lead_status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_platform_user_id ON public.leads(platform, platform_user_id);
CREATE INDEX idx_leads_engagement_type ON public.leads(engagement_type);

-- Full-text search index
CREATE INDEX idx_leads_search ON public.leads USING gin(
  to_tsvector('english', 
    COALESCE(platform_name, '') || ' ' || 
    COALESCE(platform_username, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(comment_text, '')
  )
);

-- RLS Policies
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Users can view their own leads
CREATE POLICY "Users can view their own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all leads
CREATE POLICY "Admins can view all leads"
  ON public.leads FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage leads"
  ON public.leads FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();
```

### 3.2 Lead Events Table (Audit Trail)

```sql
-- Migration: 20260120000001_create_lead_events_table.sql

CREATE TABLE public.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'status_changed', 'contacted', 'note_added', 
    'tag_added', 'tag_removed', 'exported', 'merged', 'deleted'
  )),
  event_data JSONB, -- Additional event-specific data
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_lead_events_lead_id ON public.lead_events(lead_id);
CREATE INDEX idx_lead_events_created_at ON public.lead_events(created_at DESC);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their leads"
  ON public.lead_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads 
      WHERE leads.id = lead_events.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all events"
  ON public.lead_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
```

### 3.3 Lead Scores Table (Historical Tracking)

```sql
-- Migration: 20260120000002_create_lead_scores_table.sql

CREATE TABLE public.lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  score_breakdown JSONB, -- Detailed scoring breakdown
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_scores_lead_id ON public.lead_scores(lead_id);
CREATE INDEX idx_lead_scores_calculated_at ON public.lead_scores(calculated_at DESC);
```

### 3.4 Lead Deduplication View

```sql
-- Migration: 20260120000003_create_lead_deduplication_view.sql

CREATE OR REPLACE VIEW public.lead_deduplication AS
SELECT 
  platform,
  platform_user_id,
  COUNT(*) as duplicate_count,
  array_agg(DISTINCT id) as lead_ids,
  array_agg(DISTINCT content_id) as content_ids,
  MAX(created_at) as latest_created_at,
  MIN(created_at) as earliest_created_at
FROM public.leads
GROUP BY platform, platform_user_id
HAVING COUNT(*) > 1;

-- Grant access
GRANT SELECT ON public.lead_deduplication TO authenticated;
```

---

## 4. API Endpoints

### 4.1 Capture Leads Edge Function

**File**: `supabase/functions/capture-leads/index.ts`

**Purpose**: Fetches engagement data from social media platforms and creates lead records

**Trigger**: Scheduled cron job (every 15 minutes) or manual trigger

**Input**:
```json
{
  "contentId": "optional-content-id",
  "platform": "optional-platform-filter",
  "forceRefresh": false
}
```

**Process**:
1. Fetch all published content (or specific content if contentId provided)
2. For each published post, call platform APIs to get:
   - **Facebook**: Reactions, Comments (with user details)
   - **Instagram**: Likes, Comments (with user details)
   - **YouTube**: Views, Likes, Comments (with user details)
3. Create/update lead records for each engagement
4. Calculate lead scores
5. Return summary

**Output**:
```json
{
  "success": true,
  "leadsCaptured": 45,
  "leadsUpdated": 12,
  "errors": []
}
```

### 4.2 Enrich Leads Edge Function

**File**: `supabase/functions/enrich-leads/index.ts`

**Purpose**: Enriches lead data with additional information from social media APIs

**Trigger**: Background job or manual trigger

**Input**:
```json
{
  "leadId": "optional-lead-id",
  "batchSize": 50
}
```

**Process**:
1. Fetch leads that haven't been enriched or need re-enrichment
2. Call platform APIs to get additional user information:
   - Profile details
   - Contact information (if available)
   - Follower count
   - Engagement history
3. Update lead records with enriched data
4. Recalculate lead scores

### 4.3 Export Leads Edge Function

**File**: `supabase/functions/export-leads/index.ts`

**Purpose**: Exports leads in CRM-compatible formats

**Input**:
```json
{
  "format": "csv" | "json",
  "filters": {
    "status": ["new", "qualified"],
    "platform": ["facebook", "instagram"],
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-31"
    }
  }
}
```

**Output**: CSV or JSON file with lead data

### 4.4 Lead Analytics Edge Function

**File**: `supabase/functions/lead-analytics/index.ts`

**Purpose**: Provides analytics and insights about captured leads

**Input**:
```json
{
  "dateRange": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "groupBy": "platform" | "status" | "engagement_type"
}
```

**Output**:
```json
{
  "totalLeads": 1250,
  "byPlatform": {
    "facebook": 450,
    "instagram": 600,
    "youtube": 200
  },
  "byStatus": {
    "new": 800,
    "contacted": 300,
    "qualified": 100,
    "converted": 50
  },
  "byEngagement": {
    "like": 600,
    "comment": 400,
    "share": 150,
    "view": 100
  },
  "topContent": [...],
  "leadScoreDistribution": {...}
}
```

---

## 5. Integration Points

### 5.1 Integration with Existing Analytics

**Modify**: `supabase/functions/fetch-analytics/index.ts`

Add lead capture after analytics are fetched:

```typescript
// After updating analytics in database
if (analytics.likes > 0 || analytics.comments > 0) {
  // Trigger lead capture for this content
  await fetch(`${supabaseUrl}/functions/v1/capture-leads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contentId: content.id })
  });
}
```

### 5.2 Integration with Publishing

**Modify**: `supabase/functions/publish-social/index.ts`

After successful publishing, schedule lead capture:

```typescript
// After successful publish
if (result.success && result.postId) {
  // Schedule lead capture for this post (wait 5 minutes for initial engagement)
  // This can be done via a database trigger or scheduled job
}
```

### 5.3 Scheduled Lead Capture

**Create**: Supabase Cron Job

```sql
-- Schedule lead capture every 15 minutes
SELECT cron.schedule(
  'capture-leads-every-15min',
  '*/15 * * * *', -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/capture-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object('forceRefresh', false)
  );
  $$
);
```

---

## 6. Frontend Components

### 6.1 Leads Page

**File**: `src/pages/LeadsPage.tsx`

**Features**:
- Lead list with filters (status, platform, date range)
- Search functionality
- Bulk actions (status update, tag, export)
- Lead detail view
- Lead scoring visualization

**Components Needed**:
- `LeadList.tsx` - Main lead listing
- `LeadCard.tsx` - Individual lead card
- `LeadFilters.tsx` - Filter sidebar
- `LeadDetailDialog.tsx` - Lead detail modal
- `LeadExportDialog.tsx` - Export options

### 6.2 Lead Analytics Dashboard

**File**: `src/pages/LeadAnalyticsPage.tsx`

**Features**:
- Total leads count
- Leads by platform
- Leads by status
- Leads by engagement type
- Lead score distribution
- Top performing content
- Conversion funnel

### 6.3 Lead Management Components

**File**: `src/components/leads/`

- `LeadStatusBadge.tsx` - Status indicator
- `LeadScoreIndicator.tsx` - Score visualization
- `LeadEngagementIcon.tsx` - Engagement type icon
- `LeadActionsMenu.tsx` - Action dropdown
- `LeadNotesEditor.tsx` - Notes management
- `LeadTagsInput.tsx` - Tag management

---

## 7. Lead Capture Mechanisms

### 7.1 Facebook Lead Capture

**API Endpoints Used**:
- `/{post-id}/reactions` - Get all reactions with user details
- `/{post-id}/comments` - Get comments with user details
- `/{post-id}/insights` - Get reach/impressions

**Data Captured**:
- User ID, Name, Profile Picture
- Reaction type (like, love, etc.)
- Comment text and timestamp
- Profile URL

**Implementation**:
```typescript
async function captureFacebookLeads(postId: string, accessToken: string) {
  // Get reactions
  const reactionsRes = await fetch(
    `https://graph.facebook.com/v18.0/${postId}/reactions?limit=100&access_token=${accessToken}`
  );
  const reactions = await reactionsRes.json();
  
  // Get comments
  const commentsRes = await fetch(
    `https://graph.facebook.com/v18.0/${postId}/comments?fields=id,message,from,created_time&limit=100&access_token=${accessToken}`
  );
  const comments = await commentsRes.json();
  
  // Process and create leads
  // ...
}
```

### 7.2 Instagram Lead Capture

**API Endpoints Used**:
- `/{media-id}/likes` - Get likes with user details
- `/{media-id}/comments` - Get comments with user details
- `/{media-id}/insights` - Get reach metrics

**Data Captured**:
- User ID, Username
- Comment text and timestamp
- Profile URL

**Note**: Instagram Graph API has rate limits. Implement pagination and caching.

### 7.3 YouTube Lead Capture

**API Endpoints Used**:
- `videos?part=statistics` - Get video stats
- `commentThreads` - Get comments with user details
- `videos?part=snippet` - Get video details

**Data Captured**:
- Channel ID, Channel Name
- Comment text and timestamp
- Subscriber count (if available)
- Channel URL

**Note**: YouTube API requires OAuth2 and has quota limits.

### 7.4 Lead Scoring Algorithm

**Scoring Factors**:
1. **Engagement Type** (Weight: 30%)
   - Comment: 30 points
   - Share: 25 points
   - Like: 10 points
   - View: 5 points

2. **Engagement Frequency** (Weight: 20%)
   - Multiple engagements: +20 points
   - Single engagement: +5 points

3. **Comment Quality** (Weight: 20%)
   - Question in comment: +20 points
   - Positive sentiment: +15 points
   - Long comment: +10 points

4. **Profile Completeness** (Weight: 15%)
   - Has email: +15 points
   - Has phone: +10 points
   - Complete profile: +10 points

5. **Follower Count** (Weight: 15%)
   - High follower count: +15 points
   - Medium: +10 points
   - Low: +5 points

**Formula**:
```
lead_score = (
  engagement_type_score * 0.30 +
  engagement_frequency_score * 0.20 +
  comment_quality_score * 0.20 +
  profile_completeness_score * 0.15 +
  follower_count_score * 0.15
)
```

---

## 8. Data Flow

### 8.1 Lead Capture Flow

```
1. Scheduled Job Triggers (Every 15 minutes)
   ↓
2. Fetch Published Content with social_post_id
   ↓
3. For Each Content Item:
   a. Call Platform API (Facebook/Instagram/YouTube)
   b. Get Engagement Data (Likes, Comments, Shares, Views)
   c. Extract User Information
   ↓
4. For Each Engagement:
   a. Check if Lead Exists (platform + platform_user_id + content_id)
   b. If New: Create Lead Record
   c. If Exists: Update Engagement Count
   d. Calculate/Update Lead Score
   ↓
5. Create Lead Events for Audit Trail
   ↓
6. Return Summary
```

### 8.2 Lead Enrichment Flow

```
1. Fetch Leads Needing Enrichment
   (last_enriched_at is NULL or > 7 days old)
   ↓
2. For Each Lead:
   a. Call Platform API for User Details
   b. Extract Additional Information
   c. Update Lead Record
   d. Recalculate Lead Score
   ↓
3. Update last_enriched_at timestamp
```

### 8.3 Lead Export Flow

```
1. User Requests Export with Filters
   ↓
2. Query Leads Based on Filters
   ↓
3. Format Data for CRM:
   - CSV: Standard columns
   - JSON: Structured format
   ↓
4. Generate File
   ↓
5. Return Download Link or Stream
```

---

## 9. CRM Export Functionality

### 9.1 Export Formats

#### CSV Format
```csv
Lead ID,Platform,Name,Username,Email,Phone,Engagement Type,Engagement Date,Lead Score,Status,Content Title,Comment Text
uuid-1,facebook,John Doe,johndoe,john@example.com,,comment,2026-01-20,75,new,Post Title,"Great post!"
```

#### JSON Format
```json
{
  "exportDate": "2026-01-20T10:00:00Z",
  "totalLeads": 150,
  "leads": [
    {
      "id": "uuid-1",
      "platform": "facebook",
      "name": "John Doe",
      "username": "johndoe",
      "email": "john@example.com",
      "phone": null,
      "engagementType": "comment",
      "engagementDate": "2026-01-20T08:30:00Z",
      "leadScore": 75,
      "status": "new",
      "contentTitle": "Post Title",
      "commentText": "Great post!",
      "profileUrl": "https://facebook.com/johndoe"
    }
  ]
}
```

### 9.2 CRM-Specific Formats

#### Salesforce Format
- Custom field mapping
- Lead source tracking
- Campaign association

#### HubSpot Format
- Contact properties
- Deal association
- Timeline events

### 9.3 Export Features
- Filter by date range, status, platform
- Select specific fields to export
- Bulk export (all leads)
- Scheduled exports (future feature)
- Export history tracking

---

## 10. Implementation Steps

### Phase 1: Database Setup (Week 1)

1. **Create Database Migrations**
   - [ ] Create `leads` table
   - [ ] Create `lead_events` table
   - [ ] Create `lead_scores` table
   - [ ] Create indexes and constraints
   - [ ] Set up RLS policies
   - [ ] Create deduplication view

2. **Update TypeScript Types**
   - [ ] Update `src/integrations/supabase/types.ts`
   - [ ] Add Lead types

### Phase 2: Backend Functions (Week 2)

1. **Create Capture Leads Function**
   - [ ] Implement Facebook lead capture
   - [ ] Implement Instagram lead capture
   - [ ] Implement YouTube lead capture
   - [ ] Add lead deduplication logic
   - [ ] Implement lead scoring

2. **Create Enrich Leads Function**
   - [ ] Implement profile enrichment
   - [ ] Add contact information extraction
   - [ ] Update lead scores

3. **Create Export Leads Function**
   - [ ] Implement CSV export
   - [ ] Implement JSON export
   - [ ] Add filtering logic

4. **Create Lead Analytics Function**
   - [ ] Implement analytics queries
   - [ ] Add aggregation logic

5. **Set Up Scheduled Jobs**
   - [ ] Configure cron job for lead capture
   - [ ] Configure cron job for lead enrichment

### Phase 3: Integration (Week 3)

1. **Integrate with Analytics**
   - [ ] Modify `fetch-analytics` function
   - [ ] Add lead capture trigger

2. **Integrate with Publishing**
   - [ ] Modify `publish-social` function
   - [ ] Add post-publish lead capture

3. **Update Existing Hooks**
   - [ ] Create `useLeads` hook
   - [ ] Add lead fetching logic

### Phase 4: Frontend Development (Week 4-5)

1. **Leads Page**
   - [ ] Create `LeadsPage.tsx`
   - [ ] Create `LeadList.tsx`
   - [ ] Create `LeadCard.tsx`
   - [ ] Create `LeadFilters.tsx`
   - [ ] Create `LeadDetailDialog.tsx`

2. **Lead Analytics Page**
   - [ ] Create `LeadAnalyticsPage.tsx`
   - [ ] Add charts and visualizations
   - [ ] Add metrics cards

3. **Lead Management Components**
   - [ ] Create status badge component
   - [ ] Create score indicator
   - [ ] Create actions menu
   - [ ] Create notes editor
   - [ ] Create tags input

4. **Export Functionality**
   - [ ] Create export dialog
   - [ ] Add export button
   - [ ] Implement download logic

5. **Navigation**
   - [ ] Add Leads link to sidebar
   - [ ] Add Lead Analytics link
   - [ ] Update routing

### Phase 5: Testing & Optimization (Week 6)

1. **Testing**
   - [ ] Test lead capture from all platforms
   - [ ] Test deduplication logic
   - [ ] Test lead scoring
   - [ ] Test export functionality
   - [ ] Test RLS policies

2. **Optimization**
   - [ ] Optimize database queries
   - [ ] Add caching where appropriate
   - [ ] Optimize API calls
   - [ ] Add error handling

3. **Documentation**
   - [ ] Document API endpoints
   - [ ] Document database schema
   - [ ] Create user guide

---

## 11. Technical Requirements

### 11.1 Dependencies

**New NPM Packages**:
```json
{
  "papaparse": "^5.4.1", // CSV parsing/export
  "date-fns": "^3.6.0", // Already installed
  "recharts": "^2.15.4" // Already installed for charts
}
```

### 11.2 Environment Variables

**Supabase Secrets** (Already configured):
- `FACEBOOK_ACCESS_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`
- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`

**New Secrets** (if needed):
- `LEAD_CAPTURE_ENABLED=true`
- `LEAD_ENRICHMENT_ENABLED=true`
- `MAX_LEADS_PER_BATCH=100`

### 11.3 API Rate Limits

**Facebook/Instagram**:
- 200 calls per hour per user
- Implement rate limiting and caching
- Use batch requests where possible

**YouTube**:
- 10,000 units per day
- Comment threads: 1 unit
- Video list: 1 unit
- Implement quota management

### 11.4 Performance Considerations

1. **Database Indexing**: All foreign keys and frequently queried fields indexed
2. **Pagination**: Implement pagination for lead lists
3. **Caching**: Cache platform API responses where possible
4. **Batch Processing**: Process leads in batches to avoid timeouts
5. **Background Jobs**: Use scheduled jobs for heavy operations

### 11.5 Security Considerations

1. **RLS Policies**: Ensure proper row-level security
2. **API Keys**: Store securely in Supabase Secrets
3. **Data Privacy**: Comply with GDPR/CCPA
4. **Access Control**: Admin-only access to sensitive operations
5. **Audit Trail**: Track all lead modifications

---

## 12. Additional Features (Future Enhancements)

### 12.1 Advanced Lead Scoring
- Machine learning-based scoring
- Behavioral pattern analysis
- Predictive conversion probability

### 12.2 Lead Nurturing
- Automated email sequences
- Social media follow-up
- Personalized content recommendations

### 12.3 CRM Integration
- Direct API integration with Salesforce
- Direct API integration with HubSpot
- Webhook support for real-time sync

### 12.4 Lead Segmentation
- Automatic segmentation based on behavior
- Custom segment creation
- Segment-based campaigns

### 12.5 Advanced Analytics
- Lead source attribution
- Conversion tracking
- ROI analysis
- Cohort analysis

---

## 13. File Structure

```
supabase/
  functions/
    capture-leads/
      index.ts
    enrich-leads/
      index.ts
    export-leads/
      index.ts
    lead-analytics/
      index.ts
  migrations/
    20260120000000_create_leads_table.sql
    20260120000001_create_lead_events_table.sql
    20260120000002_create_lead_scores_table.sql
    20260120000003_create_lead_deduplication_view.sql

src/
  pages/
    LeadsPage.tsx
    LeadAnalyticsPage.tsx
  components/
    leads/
      LeadList.tsx
      LeadCard.tsx
      LeadFilters.tsx
      LeadDetailDialog.tsx
      LeadStatusBadge.tsx
      LeadScoreIndicator.tsx
      LeadEngagementIcon.tsx
      LeadActionsMenu.tsx
      LeadNotesEditor.tsx
      LeadTagsInput.tsx
      LeadExportDialog.tsx
  hooks/
    useLeads.tsx
  types/
    lead.ts
```

---

## 14. Success Metrics

### 14.1 Key Performance Indicators (KPIs)

1. **Lead Capture Rate**: % of engagements captured as leads
2. **Lead Quality Score**: Average lead score
3. **Conversion Rate**: % of leads converted to customers
4. **Time to Contact**: Average time from lead capture to first contact
5. **Platform Performance**: Leads captured per platform

### 14.2 Monitoring

- Daily lead capture count
- Lead score distribution
- Platform-specific metrics
- Error rates and API failures
- Export usage statistics

---

## 15. Troubleshooting Guide

### 15.1 Common Issues

**Issue**: No leads being captured
- Check API tokens are valid
- Verify content has `social_post_id`
- Check edge function logs
- Verify cron job is running

**Issue**: Duplicate leads
- Check deduplication logic
- Verify unique constraints
- Review engagement timestamp handling

**Issue**: Low lead scores
- Review scoring algorithm
- Check data enrichment status
- Verify engagement data quality

**Issue**: Export failures
- Check file size limits
- Verify filter logic
- Review error logs

---

## Conclusion

This document provides a complete blueprint for building a lead generation application integrated with your social media platform. Follow the implementation steps sequentially, and you'll have a fully functional lead capture and management system ready for CRM integration.

**Next Steps**:
1. Review and approve this document
2. Set up database migrations
3. Begin Phase 1 implementation
4. Test with a small set of content
5. Iterate based on feedback

**Questions or Updates?**
- Document version: 1.0
- Last updated: 2026-01-20
- Contact: Development Team
