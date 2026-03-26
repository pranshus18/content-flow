# PostgreSQL Migration Quick Reference

## 🎯 What You're Replacing

| Supabase Feature | Replacement |
|-----------------|-------------|
| **Database** | PostgreSQL (same, just different connection) |
| **Auth** | Custom JWT auth (jsonwebtoken + bcrypt) |
| **Storage** | AWS S3 or Cloudinary |
| **Edge Functions** | Express.js API routes |
| **RLS Policies** | Application-level authorization |

---

## 📁 New File Structure

```
project/
├── backend/                    # NEW - Express.js API
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── content.ts
│   │   │   └── media.ts
│   │   ├── services/
│   │   │   ├── db.ts
│   │   │   ├── auth.ts
│   │   │   └── storage.ts
│   │   └── middleware/
│   │       └── auth.ts
│   └── package.json
├── src/                        # EXISTING - React frontend
│   └── integrations/
│       └── api/               # NEW - Replace supabase/
│           └── client.ts
└── supabase/                   # KEEP - For migrations only
    └── migrations/
```

---

## 🔄 Code Pattern Changes

### Authentication

**Before (Supabase):**
```typescript
await supabase.auth.signUp({ email, password });
await supabase.auth.signInWithPassword({ email, password });
const { data: { user } } = await supabase.auth.getUser();
```

**After (Custom API):**
```typescript
await api.signUp({ email, password });
await api.signIn({ email, password });
const user = await api.getCurrentUser();
```

### Database Queries

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .from('content')
  .select('*')
  .eq('user_id', user.id);
```

**After (API):**
```typescript
const data = await api.getContent();
```

### File Uploads

**Before (Supabase Storage):**
```typescript
await supabase.storage
  .from('content-media')
  .upload(filePath, file);
const { data: { publicUrl } } = supabase.storage
  .from('content-media')
  .getPublicUrl(filePath);
```

**After (API + S3/Cloudinary):**
```typescript
const { url } = await api.uploadMedia(file, userId);
```

---

## 🗄️ Database Changes

### Remove Supabase-Specific Features

1. **Remove `auth.users` references** → Create your own `users` table
2. **Remove `auth.uid()` calls** → Use `req.userId` from JWT
3. **Remove RLS policies** → Handle in application code
4. **Remove `storage.*` tables** → Not needed (use S3/Cloudinary)

### Keep These

- ✅ All table schemas
- ✅ Triggers (update timestamps, etc.)
- ✅ RPC functions (convert to API endpoints)
- ✅ Indexes and constraints

---

## 🔐 Authentication Flow

### Sign Up
1. Frontend → `POST /api/auth/signup`
2. Backend → Hash password (bcrypt)
3. Backend → Insert into `users` table
4. Backend → Create `user_roles` entry
5. Backend → Generate JWT token
6. Backend → Return user + token
7. Frontend → Store token in localStorage

### Sign In
1. Frontend → `POST /api/auth/signin`
2. Backend → Verify password (bcrypt)
3. Backend → Generate JWT token
4. Backend → Return user + token
5. Frontend → Store token in localStorage

### Protected Routes
1. Frontend → Include token in `Authorization: Bearer <token>` header
2. Backend → Verify JWT token (middleware)
3. Backend → Extract `userId` from token
4. Backend → Use `userId` for queries

---

## 📦 Required Packages

### Backend
```json
{
  "express": "^4.18.2",
  "pg": "^8.11.0",
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  "multer": "^1.4.5-lts.1",
  "aws-sdk": "^2.1400.0",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1"
}
```

### Frontend
- Remove: `@supabase/supabase-js`
- Add: Nothing new (use native `fetch`)

---

## 🌐 API Endpoints to Create

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/signup` | POST | User registration |
| `/api/auth/signin` | POST | User login |
| `/api/auth/me` | GET | Get current user |
| `/api/content` | GET | List content |
| `/api/content` | POST | Create content |
| `/api/content/:id` | PUT | Update content |
| `/api/content/:id` | DELETE | Delete content |
| `/api/media/upload` | POST | Upload file |
| `/api/media/preprocess` | POST | Preprocess media |
| `/api/media/enhance` | POST | Enhance media |
| `/api/content/publish` | POST | Publish content |
| `/api/social/publish` | POST | Publish to social |
| `/api/analytics/:id` | GET | Get analytics |

---

## 🔧 Environment Variables

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/contentflow
JWT_SECRET=your-secret-key
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET=contentflow-media
```

---

## ✅ Migration Checklist

### Phase 1: Setup
- [ ] Set up PostgreSQL database
- [ ] Run all migrations (remove Supabase-specific parts)
- [ ] Create `users` table
- [ ] Test database connection

### Phase 2: Backend
- [ ] Create Express.js server
- [ ] Set up database connection
- [ ] Implement auth routes
- [ ] Implement content routes
- [ ] Implement media upload routes
- [ ] Migrate all 7 edge functions to API routes
- [ ] Set up file storage (S3/Cloudinary)

### Phase 3: Frontend
- [ ] Create API client
- [ ] Update `useAuth` hook
- [ ] Update `useContent` hook
- [ ] Update all pages
- [ ] Update all components
- [ ] Update file upload logic

### Phase 4: Testing
- [ ] Test authentication
- [ ] Test content CRUD
- [ ] Test file uploads
- [ ] Test admin features
- [ ] Test media processing
- [ ] Test social publishing

---

## 🚀 Quick Start Commands

### Backend Setup
```bash
mkdir backend
cd backend
npm init -y
npm install express pg jsonwebtoken bcrypt multer aws-sdk cors dotenv
npm install -D @types/express @types/node @types/pg @types/jsonwebtoken @types/bcrypt typescript ts-node
```

### Database Setup
```bash
# Local PostgreSQL
createdb contentflow
psql contentflow < supabase/migrations/20260102155501_*.sql
# ... run all migrations
```

### Run Backend
```bash
cd backend
npm run dev  # or node src/server.ts
```

### Run Frontend
```bash
npm run dev
```

---

## 📝 Key Files to Modify

### Delete/Replace
- `src/integrations/supabase/client.ts` → `src/integrations/api/client.ts`
- `src/integrations/supabase/types.ts` → Delete (or generate from API)

### Update
- All files importing from `@/integrations/supabase/client`
- All hooks using `supabase`
- All components using `supabase`
- All pages using `supabase`

### Create
- Entire `backend/` directory
- All API routes
- Database service
- Auth service
- Storage service

---

## ⚠️ Common Pitfalls

1. **Don't forget to hash passwords** - Use bcrypt
2. **Don't expose JWT secret** - Keep in environment variables
3. **Don't use string concatenation for SQL** - Use parameterized queries
4. **Don't forget CORS** - Configure for your frontend domain
5. **Don't skip error handling** - Handle all API errors gracefully

---

## 🎯 Estimated Timeline

- **Week 1:** Database setup + Backend foundation
- **Week 2:** Auth + Content CRUD
- **Week 3:** File storage + Media processing
- **Week 4:** Testing + Bug fixes

**Total: 3-4 weeks** (depending on experience level)

---

For detailed instructions, see `POSTGRESQL_MIGRATION_GUIDE.md`
