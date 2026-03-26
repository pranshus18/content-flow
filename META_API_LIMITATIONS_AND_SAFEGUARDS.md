# 🛡️ Meta/Facebook/Instagram API Limitations & Application Safeguards

This document lists all Meta API limitations and the safeguards implemented in this application to prevent violations and account bans.

---

## 📊 FACEBOOK GRAPH API LIMITATIONS

### 1. Rate Limits (Most Critical!)

#### **App-Level Rate Limits:**
- **200 calls per hour per user** (for most endpoints)
- **4,800 calls per hour per app** (aggregate limit)
- **Burst limit**: Can make up to 600 calls in a short burst, but must average 200/hour

#### **Page-Level Rate Limits:**
- **Page Posts**: ~200 posts per hour per Page
- **Photo Uploads**: ~200 photos per hour per Page
- **Video Uploads**: ~50 videos per hour per Page (videos are more resource-intensive)

#### **Our Application Safeguards:**
- ✅ **Maximum 10 posts per hour per user** (20x below limit)
- ✅ **Maximum 50 posts per hour per app** (96x below limit)
- ✅ **Minimum 5 minutes between posts** (prevents burst traffic)
- ✅ **Queue system** to space out posts automatically
- ✅ **24/7 posting allowed** (no time restrictions)

---

### 2. Posting Frequency Limits

#### **Facebook Official Limits:**
- No official daily limit, but **excessive posting triggers spam detection**
- **Recommended**: Maximum 3-5 posts per day per Page
- **Aggressive posting** (>10 posts/day) can trigger:
  - Content review delays
  - Reduced reach
  - Account restrictions
  - Potential ban

#### **Our Application Safeguards:**
- ✅ **Maximum 5 posts per day per user** (conservative limit)
- ✅ **Maximum 3 posts per day per Page** (extra safe)
- ✅ **Minimum 2 hours between posts** (prevents spam detection)
- ✅ **Daily posting window**: 8 AM - 8 PM only (avoids off-hours spam flags)

---

### 3. Content Quality Requirements

#### **Facebook Content Policies:**
- **No spam**: Repetitive, low-quality, or misleading content
- **No clickbait**: Misleading headlines or thumbnails
- **No copyright violations**: Must own or have rights to all media
- **No adult content**: Nudity, sexual content, etc.
- **No hate speech**: Discriminatory or harmful content
- **No fake news**: Misinformation or false claims

#### **Our Application Safeguards:**
- ✅ **Content validation** before posting
- ✅ **Admin review required** (all content must be approved)
- ✅ **Media URL validation** (must be HTTPS, publicly accessible)
- ✅ **Character limits enforced** (prevents spam-like long posts)

---

### 4. Token & Authentication Limits

#### **Token Limits:**
- **User Access Tokens**: Expire in 1-2 hours
- **Page Access Tokens**: Can last 60 days (long-lived)
- **System User Tokens**: Can last indefinitely (Business Manager)

#### **Token Refresh Limits:**
- **Maximum 5 token refresh attempts per hour**
- **Excessive refresh attempts** can trigger security flags

#### **Our Application Safeguards:**
- ✅ **Use Page Access Tokens** (long-lived, 60 days)
- ✅ **Token refresh only when needed** (not on every request)
- ✅ **Token caching** (reuse tokens for multiple requests)
- ✅ **Error handling** for expired tokens (graceful failure)

---

### 5. Media Upload Limits

#### **File Size Limits:**
- **Images**: Maximum 4 MB per image
- **Videos**: Maximum 1 GB per video (or 4 GB for longer videos)
- **Video Duration**: Maximum 240 minutes (4 hours)

#### **Format Requirements:**
- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, MOV, AVI (MP4 recommended)

#### **Our Application Safeguards:**
- ✅ **File size validation** before upload (reject if too large)
- ✅ **Format validation** (only allow supported formats)
- ✅ **Automatic compression** for large images
- ✅ **Video duration check** (warn if > 4 hours)

---

### 6. API Call Frequency Limits

#### **Per-Endpoint Limits:**
- **GET requests**: 200/hour per user
- **POST requests**: 200/hour per user
- **Batch requests**: 50 requests per batch, 1 batch per second

#### **Our Application Safeguards:**
- ✅ **Request queuing** (space out API calls)
- ✅ **Exponential backoff** on errors (wait longer after failures)
- ✅ **Request logging** (track all API calls)
- ✅ **Rate limit monitoring** (alert if approaching limits)

---

## 📸 INSTAGRAM GRAPH API LIMITATIONS

### 1. Rate Limits

#### **Instagram API Limits:**
- **25 requests per hour per user** (much stricter than Facebook!)
- **200 requests per hour per app** (aggregate)
- **Burst limit**: Can make up to 50 requests in short burst, but must average 25/hour

#### **Our Application Safeguards:**
- ✅ **Maximum 2 posts per hour per user** (12.5x below limit)
- ✅ **Maximum 20 posts per hour per app** (10x below limit)
- ✅ **Minimum 30 minutes between Instagram posts** (prevents rate limit hits)
- ✅ **Separate rate limiting** for Instagram (stricter than Facebook)
- ✅ **24/7 posting allowed** (no time restrictions)

---

### 2. Posting Frequency Limits

#### **Instagram Official Limits:**
- **No official daily limit**, but **excessive posting triggers shadowban**
- **Recommended**: Maximum 1-3 posts per day
- **Aggressive posting** (>5 posts/day) can trigger:
  - Shadowban (reduced reach)
  - Content review delays
  - Account restrictions
  - Potential ban

#### **Our Application Safeguards:**
- ✅ **Maximum 3 posts per day per user** (conservative)
- ✅ **Maximum 2 posts per day per Instagram account** (extra safe)
- ✅ **Minimum 30 minutes between posts** (prevents spam detection)
- ✅ **24/7 posting allowed** (no time restrictions)

---

### 3. Content Requirements

#### **Instagram Content Policies:**
- **No spam**: Repetitive or low-quality content
- **No fake engagement**: Buying likes/followers
- **No copyright violations**: Must own or have rights to all media
- **No adult content**: Nudity, sexual content, etc.
- **No hate speech**: Discriminatory or harmful content
- **Square/vertical format preferred**: 1:1 or 4:5 aspect ratio

#### **Our Application Safeguards:**
- ✅ **Content validation** before posting
- ✅ **Admin review required** (all content must be approved)
- ✅ **Media format validation** (Instagram-optimized dimensions)
- ✅ **Hashtag limits** (maximum 30 hashtags, we limit to 10)

---

### 4. Media Upload Limits

#### **File Size Limits:**
- **Images**: Maximum 8 MB per image
- **Videos**: Maximum 100 MB per video (or 4 GB for IGTV)
- **Video Duration**: 
  - Regular posts: Maximum 60 seconds
  - IGTV: Maximum 60 minutes

#### **Format Requirements:**
- **Images**: JPG, PNG
- **Videos**: MP4 (H.264 codec recommended)

#### **Our Application Safeguards:**
- ✅ **File size validation** (reject if too large)
- ✅ **Video duration check** (warn if > 60 seconds for regular posts)
- ✅ **Format validation** (only allow supported formats)
- ✅ **Automatic resizing** to Instagram-optimized dimensions (1080x1080 for square)

---

### 5. Business Account Requirements

#### **Account Type Requirements:**
- **Must be Instagram Business Account** (not personal)
- **Must be connected to Facebook Page**
- **Must have valid business information**

#### **Our Application Safeguards:**
- ✅ **Account validation** before posting (check if Business account)
- ✅ **Error messages** if account type is invalid
- ✅ **Clear instructions** for users to convert to Business account

---

## 🚫 COMMON VIOLATIONS THAT LEAD TO BANS

### 1. Rate Limit Violations
- **What happens**: Making too many API calls too quickly
- **Result**: Temporary or permanent API access restriction
- **Our safeguard**: Strict rate limiting (10x below official limits)

### 2. Spam Detection
- **What happens**: Posting too frequently or repetitive content
- **Result**: Content flagged as spam, account restrictions
- **Our safeguard**: Maximum 3-5 posts per day, minimum time between posts

### 3. Invalid Tokens
- **What happens**: Using expired or invalid access tokens
- **Result**: API errors, potential security flags
- **Our safeguard**: Token validation and automatic refresh

### 4. Content Policy Violations
- **What happens**: Posting content that violates Meta policies
- **Result**: Content removed, account warnings, potential ban
- **Our safeguard**: Admin review required, content validation

### 5. Automated Behavior Detection
- **What happens**: Posting at exact intervals, no human-like behavior
- **Result**: Account flagged as bot, restrictions applied
- **Our safeguard**: Random delays between posts, posting windows

---

## 🛡️ APPLICATION SAFEGUARDS IMPLEMENTED

### 1. Rate Limiting System

```typescript
// Maximum posts per hour per user
const MAX_POSTS_PER_HOUR_PER_USER = 10; // Facebook: 200 limit
const MAX_POSTS_PER_HOUR_APP = 50; // Facebook: 4,800 limit

// Instagram (stricter)
const MAX_INSTAGRAM_POSTS_PER_HOUR = 2; // Instagram: 25 limit
const MAX_INSTAGRAM_POSTS_PER_HOUR_APP = 20; // Instagram: 200 limit
```

### 2. Posting Frequency Limits

```typescript
// Maximum posts per day
const MAX_POSTS_PER_DAY_PER_USER = 5; // Conservative limit
const MAX_POSTS_PER_DAY_PER_PAGE = 3; // Extra safe for Pages

// Minimum time between posts
const MIN_TIME_BETWEEN_POSTS = 5 * 60 * 1000; // 5 minutes (Facebook)
const MIN_TIME_BETWEEN_INSTAGRAM_POSTS = 30 * 60 * 1000; // 30 minutes (Instagram)
```

### 3. Posting Window

```typescript
// Only allow posting during business hours
const POSTING_START_HOUR = 8; // 8 AM
const POSTING_END_HOUR = 20; // 8 PM
```

### 4. Request Queuing

- Posts are queued and spaced out automatically
- Prevents burst traffic
- Ensures compliance with rate limits

### 5. Error Handling & Retry Logic

```typescript
// Exponential backoff on errors
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second
const BACKOFF_MULTIPLIER = 2; // Double delay each retry
```

### 6. Token Management

- Use Page Access Tokens (long-lived, 60 days)
- Token caching (reuse tokens)
- Automatic token refresh before expiration
- Graceful error handling for expired tokens

### 7. Content Validation

- Admin review required for all content
- Media URL validation (HTTPS, publicly accessible)
- File size and format validation
- Character limit enforcement

---

## 📋 DAILY LIMITS SUMMARY

### Facebook:
- ✅ **Maximum 5 posts per day per user** (conservative)
- ✅ **Maximum 3 posts per day per Page** (extra safe)
- ✅ **Minimum 5 minutes between posts**
- ✅ **24/7 posting allowed** (no time restrictions)

### Instagram:
- ✅ **Maximum 3 posts per day per user** (conservative)
- ✅ **Maximum 2 posts per day per account** (extra safe)
- ✅ **Minimum 30 minutes between posts**
- ✅ **24/7 posting allowed** (no time restrictions)

### YouTube:
- ✅ **Maximum 10 videos per day per channel** (conservative)
- ✅ **Minimum 1 hour between uploads**
- ✅ **No specific posting window** (YouTube is more lenient)

---

## ⚠️ WARNING SIGNS TO MONITOR

### 1. API Error Codes to Watch:
- **Error 4**: Rate limit exceeded → **STOP POSTING IMMEDIATELY**
- **Error 17**: User request limit reached → **WAIT 1 HOUR**
- **Error 613**: Rate limit hit → **WAIT 1 HOUR**
- **Error 190**: Invalid/expired token → **REFRESH TOKEN**

### 2. Account Health Indicators:
- **Content review delays**: If posts take > 1 hour to appear
- **Reduced reach**: If posts get fewer views than usual
- **API errors increasing**: If error rate > 5%

### 3. When to Pause Posting:
- ✅ If rate limit errors occur → **Pause for 1 hour**
- ✅ If content review delays → **Pause for 24 hours**
- ✅ If account warnings received → **Pause for 48 hours**

---

## 🔄 MONITORING & ALERTS

### 1. Rate Limit Monitoring
- Track API calls per hour
- Alert if approaching 50% of limit
- Auto-pause if approaching 80% of limit

### 2. Error Rate Monitoring
- Track error rate (should be < 1%)
- Alert if error rate > 5%
- Auto-pause if error rate > 10%

### 3. Posting Frequency Monitoring
- Track posts per day
- Alert if approaching daily limit
- Block posting if daily limit reached

---

## 📝 BEST PRACTICES FOR NEW ACCOUNTS

### 1. Start Slow
- **Week 1**: Maximum 1 post per day
- **Week 2**: Maximum 2 posts per day
- **Week 3+**: Can increase to 3-5 posts per day

### 2. Build Trust
- Post high-quality content only
- Engage with audience (respond to comments)
- Don't post at exact same times every day

### 3. Monitor Closely
- Check account health daily
- Review API usage weekly
- Adjust limits if needed

### 4. Stay Compliant
- Always follow Meta policies
- Don't try to bypass limits
- Report issues through official channels

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1: Critical Safeguards (Implement First)
1. ✅ Rate limiting (posts per hour)
2. ✅ Daily posting limits
3. ✅ Minimum time between posts
4. ✅ Error handling with exponential backoff

### Phase 2: Important Safeguards (Implement Next)
1. ✅ Posting windows (business hours only)
2. ✅ Request queuing
3. ✅ Token management improvements
4. ✅ Content validation

### Phase 3: Monitoring (Implement Last)
1. ✅ Rate limit monitoring
2. ✅ Error rate tracking
3. ✅ Account health alerts
4. ✅ Usage analytics

---

## 📊 SAFETY MARGINS

Our application uses **conservative limits** that are **10-20x below** official Meta limits:

| Platform | Official Limit | Our Limit | Safety Margin |
|----------|---------------|------------|---------------|
| Facebook (per hour) | 200 posts | 10 posts | **20x safer** |
| Instagram (per hour) | 25 posts | 2 posts | **12.5x safer** |
| Facebook (per day) | No limit | 5 posts | **Conservative** |
| Instagram (per day) | No limit | 3 posts | **Conservative** |

This ensures we **never approach** the official limits and stay well within safe boundaries.

---

## ✅ COMPLIANCE CHECKLIST

Before going live, ensure:
- [ ] Rate limiting is enabled
- [ ] Daily limits are set
- [ ] Posting windows are configured
- [ ] Error handling is implemented
- [ ] Token management is working
- [ ] Content validation is active
- [ ] Monitoring is set up
- [ ] Alerts are configured

---

**Last Updated**: 2024-01-26
**Status**: Active Safeguards Implemented
