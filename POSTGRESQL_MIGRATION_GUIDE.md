# PostgreSQL Migration Guide: From Supabase to Standalone PostgreSQL

This guide will help you migrate your ContentFlow application from Supabase to a standalone PostgreSQL database.

## 📋 Table of Contents

1. [Overview](#overview)
2. [What Needs to Change](#what-needs-to-change)
3. [Migration Strategy](#migration-strategy)
4. [Step-by-Step Migration Plan](#step-by-step-migration-plan)
5. [Architecture Changes Required](#architecture-changes-required)
6. [Code Changes Required](#code-changes-required)
7. [Testing Checklist](#testing-checklist)

---

## 🎯 Overview

### Current Supabase Usage

Your application currently uses Supabase for:

1. **Database (PostgreSQL)** - All data storage
2. **Authentication** - User sign up, sign in, session management
3. **Storage** - File uploads (images, videos, logos) via Supabase Storage
4. **Edge Functions** - 7 serverless functions for media processing
5. **Row Level Security (RLS)** - Database-level access control
6. **Real-time Subscriptions** - Auth state changes

### What You'll Need to Replace

- ✅ **PostgreSQL Database** - Can keep the same schema
- ❌ **Supabase Auth** → Replace with custom auth (JWT, Passport.js, or similar)
- ❌ **Supabase Storage** → Replace with S3, Cloudinary, or local storage
- ❌ **Edge Functions** → Replace with Express.js API routes or separate Node.js services
- ❌ **RLS Policies** → Replace with application-level authorization

---

## 🔄 What Needs to Change

### 1. Database Layer

**Current:**
- Uses Supabase client (`@supabase/supabase-js`)
- Queries via `.from('table').select()`
- RPC functions for complex queries
- RLS policies for security

**New:**
- Use PostgreSQL client (`pg`, `node-postgres`, or `Prisma`)
- Direct SQL queries or ORM
- Application-level authorization
- Connection pooling

### 2. Authentication

**Current:**
- `supabase.auth.signUp()`
- `supabase.auth.signInWithPassword()`
- `supabase.auth.getSession()`
- `supabase.auth.onAuthStateChange()`
- Automatic JWT token management

**New:**
- Custom auth implementation
- JWT tokens (jsonwebtoken)
- Password hashing (bcrypt)
- Session management
- Manual token refresh

### 3. File Storage

**Current:**
- `supabase.storage.from('content-media').upload()`
- `supabase.storage.from('content-media').getPublicUrl()`
- Automatic CDN and public URLs

**New:**
- AWS S3, Cloudinary, or local filesystem
- Manual URL generation
- CDN configuration (if needed)

### 4. Server-Side Functions

**Current:**
- 7 Supabase Edge Functions (Deno runtime)
- Automatic deployment via Supabase CLI
- Environment variables via Supabase Secrets

**New:**
- Express.js API routes or separate Node.js services
- Manual deployment
- Environment variables via `.env` or config management

---

## 📐 Migration Strategy

### Recommended Approach: Phased Migration

**Phase 1: Database Setup**
1. Set up PostgreSQL database (local or cloud)
2. Run all migration files to create schema
3. Remove RLS policies (or adapt them)
4. Test database connectivity

**Phase 2: Backend API**
1. Create Express.js backend server
2. Migrate Edge Functions to API routes
3. Set up file storage (S3/Cloudinary)
4. Implement authentication endpoints

**Phase 3: Frontend Updates**
1. Replace Supabase client with API calls
2. Update authentication hooks
3. Update file upload logic
4. Update all database queries

**Phase 4: Testing & Deployment**
1. Test all features
2. Migrate existing data (if any)
3. Deploy backend and frontend
4. Monitor and fix issues

---

## 📝 Step-by-Step Migration Plan

### Step 1: Set Up PostgreSQL Database

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb contentflow

# Connect and verify
psql contentflow
```

#### Option B: Cloud PostgreSQL (Recommended for Production)
- **AWS RDS PostgreSQL**
- **Google Cloud SQL**
- **DigitalOcean Managed Databases**
- **Heroku Postgres**
- **Railway**
- **Supabase (just the database, not the platform)**

#### Database Connection String Format:
```
postgresql://username:password@host:port/database
```

---

### Step 2: Run Database Migrations

Your migration files are in `supabase/migrations/`. You'll need to:

1. **Run all SQL migrations in order:**
   - `20260102155501_3144baa9-c56a-407b-96ba-a613efdf2cac.sql`
   - `20260103102116_a03caafd-1a32-4086-993c-543c32deccbd.sql`
   - `20260105041239_1701d2c8-1f99-4788-a762-d9982ca8e481.sql`
   - `20260106000000_add_media_type_column.sql`
   - `20260106000001_create_user_info_view.sql`
   - `20260107000000_add_content_with_user_info.sql`
   - `20260108000000_add_video_watermark_fields.sql`
   - `20260109000000_add_video_text_overlays.sql`
   - `20260110000000_add_branding_settings.sql`
   - `20260116000000_add_company_info_fields.sql`
   - `20260125000000_setup_scheduled_publishing.sql`

2. **Modify migrations to remove Supabase-specific features:**
   - Remove `auth.users` references (create your own `users` table)
   - Remove `auth.uid()` calls (replace with application logic)
   - Remove RLS policies (or adapt for application-level auth)
   - Remove `storage.buckets` and `storage.objects` (these are Supabase-specific)

3. **Create a `users` table** (since you won't have `auth.users`):
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Step 3: Set Up Backend API Server

#### Create Express.js Backend

**File Structure:**
```
backend/
├── src/
│   ├── server.ts          # Express app entry point
│   ├── routes/
│   │   ├── auth.ts        # Authentication routes
│   │   ├── content.ts     # Content CRUD routes
│   │   ├── media.ts       # Media upload routes
│   │   └── analytics.ts   # Analytics routes
│   ├── middleware/
│   │   ├── auth.ts        # JWT authentication middleware
│   │   └── error.ts       # Error handling
│   ├── services/
│   │   ├── db.ts          # Database connection
│   │   ├── storage.ts     # File storage service
│   │   └── auth.ts        # Auth service (JWT, bcrypt)
│   └── utils/
│       └── helpers.ts
├── package.json
└── tsconfig.json
```

#### Key Dependencies:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "multer": "^1.4.5-lts.1",
    "aws-sdk": "^2.1400.0",  // or cloudinary
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

---

### Step 4: Migrate Edge Functions to API Routes

Your 7 Edge Functions need to become Express routes:

| Edge Function | New Location | Notes |
|--------------|--------------|-------|
| `preprocess-media` | `POST /api/media/preprocess` | Media preprocessing |
| `enhance-media` | `POST /api/media/enhance` | Media enhancement |
| `publish-content` | `POST /api/content/publish` | Content publishing |
| `publish-social` | `POST /api/social/publish` | Social media publishing |
| `fetch-analytics` | `GET /api/analytics/:contentId` | Analytics fetching |
| `generate-caption` | `POST /api/caption/generate` | Caption generation |
| `process-media-server` | `POST /api/media/process` | Server-side processing |

**Example Migration:**
```typescript
// Old: supabase/functions/publish-content/index.ts
// New: backend/src/routes/content.ts

import express from 'express';
import { db } from '../services/db';

const router = express.Router();

router.post('/publish', async (req, res) => {
  const { contentId } = req.body;
  
  // Same logic as edge function, but using Express
  const result = await db.query(
    'UPDATE content SET status = $1, published_at = $2 WHERE id = $3',
    ['published', new Date(), contentId]
  );
  
  res.json({ success: true, content: result.rows[0] });
});

export default router;
```

---

### Step 5: Implement Authentication

#### Create Auth Service

**File: `backend/src/services/auth.ts`**
```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
}
```

#### Create Auth Routes

**File: `backend/src/routes/auth.ts`**
```typescript
import express from 'express';
import { db } from '../services/db';
import { hashPassword, verifyPassword, generateToken } from '../services/auth';

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { email, password, first_name, last_name, phone } = req.body;
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Insert user
  const result = await db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, first_name, last_name`,
    [email, passwordHash, first_name, last_name, phone]
  );
  
  // Create user role
  await db.query(
    'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
    [result.rows[0].id, 'user']
  );
  
  // Generate token
  const token = generateToken(result.rows[0].id);
  
  res.json({ user: result.rows[0], token });
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  
  // Get user
  const userResult = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  if (userResult.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = userResult.rows[0];
  
  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate token
  const token = generateToken(user.id);
  
  res.json({ user: { id: user.id, email: user.email }, token });
});

export default router;
```

#### Create Auth Middleware

**File: `backend/src/middleware/auth.ts`**
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const { userId } = verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

### Step 6: Set Up File Storage

#### Option A: AWS S3

**File: `backend/src/services/storage.ts`**
```typescript
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export async function uploadFile(
  bucket: string,
  key: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read',
  }).promise();
  
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export function getPublicUrl(bucket: string, key: string): string {
  return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
```

#### Option B: Cloudinary

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFile(
  file: Buffer,
  folder: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      }
    ).end(file);
  });
}
```

---

### Step 7: Update Frontend Code

#### Replace Supabase Client

**Old: `src/integrations/supabase/client.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(...);
```

**New: `src/integrations/api/client.ts`**
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    return response.json();
  },
  
  // Auth methods
  async signUp(data: { email: string; password: string; ... }) {
    return this.request('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
  },
  
  async signIn(data: { email: string; password: string }) {
    return this.request('/auth/signin', { method: 'POST', body: JSON.stringify(data) });
  },
  
  // Content methods
  async getContent() {
    return this.request('/content');
  },
  
  async createContent(data: any) {
    return this.request('/content', { method: 'POST', body: JSON.stringify(data) });
  },
  
  // Media upload
  async uploadMedia(file: File, userId: string) {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    
    return response.json();
  },
};
```

#### Update Auth Hook

**Old: `src/hooks/useAuth.tsx`**
```typescript
import { supabase } from '@/integrations/supabase/client';
supabase.auth.getSession();
supabase.auth.onAuthStateChange();
```

**New: `src/hooks/useAuth.tsx`**
```typescript
import { useState, useEffect } from 'react';
import { api } from '@/integrations/api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token and get user
      api.request('/auth/me')
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('auth_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  
  const signOut = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };
  
  return { user, loading, signOut };
}
```

#### Update Content Hook

**Old: `src/hooks/useContent.tsx`**
```typescript
const { data, error } = await supabase
  .from('content')
  .select('*')
  .eq('user_id', user.id);
```

**New: `src/hooks/useContent.tsx`**
```typescript
const data = await api.getContent();
```

#### Update File Uploads

**Old:**
```typescript
const { data, error } = await supabase.storage
  .from('content-media')
  .upload(filePath, file);
const { data: urlData } = supabase.storage
  .from('content-media')
  .getPublicUrl(filePath);
```

**New:**
```typescript
const { url } = await api.uploadMedia(file, user.id);
```

---

## 🏗️ Architecture Changes Required

### Current Architecture
```
Frontend (React)
    ↓
Supabase Client
    ↓
┌─────────────────┐
│ Supabase Cloud  │
│ - Database      │
│ - Auth          │
│ - Storage       │
│ - Edge Functions│
└─────────────────┘
```

### New Architecture
```
Frontend (React)
    ↓
API Client
    ↓
┌─────────────────┐
│ Backend API     │
│ (Express.js)    │
│ - Auth Routes   │
│ - Content Routes│
│ - Media Routes  │
└─────────────────┘
    ↓
┌─────────────────┐     ┌──────────────┐
│ PostgreSQL      │     │ File Storage │
│ Database        │     │ (S3/Cloud)   │
└─────────────────┘     └──────────────┘
```

---

## 📦 Code Changes Required

### Files to Modify

1. **Remove Supabase Client:**
   - `src/integrations/supabase/client.ts` → Delete or replace
   - `src/integrations/supabase/types.ts` → Delete or replace

2. **Update All Hooks:**
   - `src/hooks/useAuth.tsx` → Use API client
   - `src/hooks/useContent.tsx` → Use API client
   - `src/hooks/useUserRole.tsx` → Use API client
   - `src/hooks/usePublishingSettings.tsx` → Use API client
   - `src/hooks/useBrandingSettings.tsx` → Use API client

3. **Update All Pages:**
   - `src/pages/AuthPage.tsx` → Use API auth
   - `src/pages/AdminDashboard.tsx` → Use API calls
   - `src/pages/SettingsPage.tsx` → Use API calls
   - `src/pages/UsersPage.tsx` → Use API calls
   - All other pages that use Supabase

4. **Update Components:**
   - `src/components/CreateContentDialog.tsx` → Use API upload
   - `src/components/AdminEditDialog.tsx` → Use API calls
   - All components using `supabase`

5. **Create New Backend:**
   - Entire `backend/` directory structure
   - All API routes
   - Database service
   - Storage service
   - Auth service

---

## ✅ Testing Checklist

### Database
- [ ] PostgreSQL connection works
- [ ] All tables created successfully
- [ ] All RPC functions migrated
- [ ] Triggers work correctly
- [ ] Data can be inserted/updated/deleted

### Authentication
- [ ] User sign up works
- [ ] User sign in works
- [ ] JWT tokens are generated correctly
- [ ] Protected routes require authentication
- [ ] Token refresh works (if implemented)
- [ ] Sign out clears session

### File Storage
- [ ] Files can be uploaded
- [ ] Files can be retrieved
- [ ] Public URLs work correctly
- [ ] File deletion works
- [ ] File size limits enforced

### Content Management
- [ ] Create content works
- [ ] Read content works (user sees own, admin sees all)
- [ ] Update content works
- [ ] Delete content works
- [ ] Content filtering works

### Media Processing
- [ ] Media preprocessing works
- [ ] Media enhancement works
- [ ] Video processing works
- [ ] Image processing works

### Social Media Publishing
- [ ] Content can be published
- [ ] Scheduled publishing works
- [ ] Analytics fetching works

### Admin Features
- [ ] Admin can view all content
- [ ] Admin can edit all content
- [ ] Admin can manage users
- [ ] Role-based access works

---

## 🔧 Environment Variables

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/contentflow

# JWT
JWT_SECRET=your-secret-key-here

# File Storage (S3)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
AWS_BUCKET=contentflow-media

# Or Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Social Media APIs (existing)
INSTAGRAM_ACCESS_TOKEN=...
YOUTUBE_CLIENT_ID=...
# etc.
```

---

## 🚨 Important Considerations

### 1. Data Migration
If you have existing data in Supabase:
- Export data from Supabase
- Transform data (remove Supabase-specific fields)
- Import into new PostgreSQL database
- Update all foreign key references

### 2. Security
- Use HTTPS in production
- Implement rate limiting
- Validate all inputs
- Use parameterized queries (prevent SQL injection)
- Store secrets securely (never commit to git)

### 3. Performance
- Use connection pooling for database
- Implement caching where appropriate
- Use CDN for static files
- Optimize database queries

### 4. Deployment
- Backend: Deploy to Heroku, Railway, AWS, or similar
- Frontend: Deploy to Vercel, Netlify, or similar
- Database: Use managed PostgreSQL service
- Storage: Use S3, Cloudinary, or similar

### 5. Monitoring
- Set up error logging (Sentry, LogRocket)
- Monitor database performance
- Track API response times
- Set up alerts for failures

---

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [JWT Authentication](https://jwt.io/introduction)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)

---

## 🎯 Next Steps

1. **Review this guide** - Understand all changes needed
2. **Set up PostgreSQL** - Local or cloud instance
3. **Create backend structure** - Set up Express.js server
4. **Migrate one feature at a time** - Start with auth, then content, etc.
5. **Test thoroughly** - Use the checklist above
6. **Deploy incrementally** - Test in staging before production

---

## ⚠️ Migration Complexity

**Estimated Time:** 2-4 weeks for full migration

**Difficulty Level:** Medium to High

**Key Challenges:**
- Replacing Supabase Auth with custom auth
- Migrating Edge Functions to Express routes
- Replacing Supabase Storage with S3/Cloudinary
- Updating all frontend code
- Testing all features

**Recommendation:** Consider keeping Supabase for database only, or migrating gradually feature by feature.

---

Good luck with your migration! 🚀
