# NEON + CLERK Setup Guide

Complete setup instructions for Lumion HRIS with NEON database and Clerk authentication.

## Prerequisites

- Node.js 20.x or higher
- npm or pnpm package manager
- Git
- Web browser for service registrations

---

## Part 1: NEON Database Setup

### 1.1 Create NEON Account

1. Go to [https://console.neon.tech/](https://console.neon.tech/)
2. Sign up with email or GitHub
3. Create a new project (free tier available)

### 1.2 Get Connection String

1. In NEON dashboard, select your project
2. Go to the **Connection** tab
3. Choose **Pooled Connection** (recommended for serverless)
4. Select **PostgreSQL** driver
5. Copy the connection string

Expected format:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

### 1.3 Update Environment Variables

Add to `.env.local`:

```bash
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

### 1.4 Initialize Database Schema

Run Prisma migrations:

```bash
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Sync schema with NEON (no migration files)
```

Or if you want migration files:

```bash
pnpm db:migrate    # Create migration files and apply
```

Check the database in NEON dashboard to verify tables were created.

---

## Part 2: CLERK Authentication Setup

### 2.1 Create Clerk Account

1. Go to [https://dashboard.clerk.com/](https://dashboard.clerk.com/)
2. Sign up with email or GitHub
3. Create a new application

### 2.2 Get API Keys

After creating application:

1. Click on **API Keys** in left sidebar
2. Copy **Publishable Key** (`pk_test_...`)
3. Copy **Secret Key** (`sk_test_...`)

### 2.3 Update Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/onboarding
```

### 2.4 Configure Webhooks (Optional - for User Sync)

If you want to sync Clerk users to your database:

1. In Clerk dashboard, go to **Webhooks**
2. Click **Create Endpoint**
3. Add endpoint URL: `http://localhost:3000/api/webhooks/clerk` (dev) or your production URL
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Copy the **Webhook Secret**
6. Add to `.env.local`: `CLERK_WEBHOOK_SECRET=whsec_xxxxxxxx`

---

## Part 3: Install Dependencies

Install all required packages:

```bash
pnpm install
```

This installs:
- `@clerk/nextjs` - Clerk authentication for Next.js
- `@prisma/client` - Database ORM
- All other dependencies

---

## Part 4: Verify Setup

### 4.1 Check Environment Variables

Create `.env.local` with:

```bash
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/onboarding
```

### 4.2 Generate Prisma Client

```bash
pnpm db:generate
```

### 4.3 Run Development Server

```bash
pnpm dev
```

Server should start on `http://localhost:3000`

### 4.4 Test Clerk Integration

1. Open `http://localhost:3000` in your browser
2. You should see the header with **Sign In** and **Sign Up** buttons
3. (If no env keys: Clerk runs in Keyless Mode, showing a "Configure your application" prompt)
4. Click **Sign Up** to create your first user
5. After signup, you should see a **User Profile** icon instead of buttons
6. Click it to see user options (Profile, Sign Out, etc.)

---

## Part 5: Create Root Tenant (Admin Setup)

After you sign up, you need to create a tenant for your organization.

### 5.1 Create Tenant via API or Script

You can create a tenant manually in the database:

```bash
pnpm prisma studio  # Opens Prisma Studio
```

In Prisma Studio:
1. Go to **Tenant** model
2. Click **Create**
3. Fill in:
   - `name`: Your company name
   - `slug`: Company slug (e.g., "my-company")
   - Any other details

### 5.2 Create User-Tenant Link

1. After signing up with Clerk, create a User record in Prisma:
2. Go to **User** model in Prisma Studio
3. Create a new User with:
   - `clerkUserId`: Your Clerk user ID (get from Clerk dashboard)
   - `email`: Your email
   - `firstName`: Your first name
   - `lastName`: Your last name
   - `tenantId`: The tenant ID you created above
   - `isActive`: `true`

### 5.3 Assign Roles and Permissions

1. Create a **Role** (e.g., "Admin", "HR Manager")
2. Create **Permissions** (e.g., "employees:read", "payroll:write")
3. Link User → Role → Permissions

---

## Part 6: Production Deployment

### Database Migration

When deploying to production:

```bash
# Apply all migrations to production database
pnpm db:deploy
```

### Environment Variables on Production

Set these on your hosting platform (Vercel, Railway, AWS, etc.):

```bash
DATABASE_URL=postgresql://[prod-user]:[prod-password]@[prod-host]/[prod-db]?sslmode=require
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://yourdomain.com/auth/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://yourdomain.com/auth/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=https://yourdomain.com/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=https://yourdomain.com/dashboard/onboarding
```

---

## File Structure Overview

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # ClerkProvider added
│   │   ├── api/
│   │   │   └── webhooks/
│   │   │       └── clerk/
│   │   │           └── route.ts  # Webhook handler
│   │   ├── auth/
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   └── lib/
│       └── clerk.ts            # Helper functions
│
middleware.ts                     # Clerk auth middleware

packages/database/
├── prisma/
│   └── schema.prisma            # Updated with clerkUserId
```

---

## API Routes Protected by Clerk

All routes are protected by `clerkMiddleware()` in `middleware.ts`:

- ✅ Public: `/`, `/auth/sign-in`, `/auth/sign-up`, `/api/health`
- 🔒 Protected: All `/dashboard` routes and other API endpoints

---

## Troubleshooting

### Issue: "Clerk API key not found"

**Solution**: Add env vars to `.env.local`:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

### Issue: "Database connection refused"

**Solution**: Check NEON connection string format:
```bash
postgresql://user:password@host/dbname?sslmode=require
```

### Issue: "Webhook failed"

**Solution**:
1. Check webhook secret matches: `CLERK_WEBHOOK_SECRET`
2. Verify endpoint URL is correct in Clerk dashboard
3. Check server logs: `pnpm dev`

### Issue: "User not synced to database"

**Solution**:
1. Webhook might not be configured
2. Check `/api/webhooks/clerk` is receiving POST requests
3. Check `CLERK_WEBHOOK_SECRET` is correct

---

## Next Steps

1. ✅ Database: NEON connected
2. ✅ Auth: Clerk configured
3. ⏭️ Create admin dashboard
4. ⏭️ Set up role-based access control (RBAC)
5. ⏭️ Build employee management features
6. ⏭️ Deploy to production

---

## Useful Links

- [NEON Documentation](https://neon.tech/docs/)
- [Clerk Documentation](https://clerk.com/docs/)
- [Clerk Next.js Integration](https://clerk.com/docs/nextjs/get-started/quickstart)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
