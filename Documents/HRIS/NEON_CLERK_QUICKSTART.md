# NEON + CLERK Quick Start Checklist

Complete this checklist to get Lumion HRIS running with NEON and Clerk.

## 1. NEON Setup (5 minutes)

- [ ] Go to https://console.neon.tech/
- [ ] Create account or sign in
- [ ] Create new project
- [ ] Copy connection string from **Connection** tab
- [ ] Add to `.env.local`:
  ```
  DATABASE_URL=postgresql://...
  ```

## 2. CLERK Setup (5 minutes)

- [ ] Go to https://dashboard.clerk.com/
- [ ] Create account or sign in
- [ ] Create new application
- [ ] Copy Publishable Key (`pk_test_...`)
- [ ] Copy Secret Key (`sk_test_...`)
- [ ] Add to `.env.local`:
  ```
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  CLERK_SECRET_KEY=sk_test_...
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard/onboarding
  ```

## 3. Local Setup (3 minutes)

- [ ] Install dependencies: `pnpm install`
- [ ] Generate Prisma client: `pnpm db:generate`
- [ ] Push schema to NEON: `pnpm db:push`
- [ ] Start dev server: `pnpm dev`
- [ ] Open http://localhost:3000

## 4. Test Authentication (2 minutes)

- [ ] See **Sign In** and **Sign Up** buttons in header
- [ ] Click **Sign Up**
- [ ] Create account with email
- [ ] After signup, see user profile icon (not buttons)
- [ ] Click profile icon → see user menu

## 5. Setup Database (Optional but Recommended)

- [ ] Open Prisma Studio: `pnpm prisma:studio`
- [ ] Create a **Tenant**:
  - `name`: Your company
  - `slug`: Company slug (e.g., "acme-corp")
- [ ] Manually create **User** record linking to Clerk:
  - `clerkUserId`: Get from Clerk dashboard
  - `email`: Your email
  - `firstName`: Your first name
  - `lastName`: Your last name
  - `tenantId`: The tenant ID above
  - `isActive`: `true`

## 6. Configure Webhooks (Optional - for Auto Sync)

- [ ] Go to Clerk dashboard → **Webhooks**
- [ ] Click **Create Endpoint**
- [ ] URL: `http://localhost:3000/api/webhooks/clerk`
- [ ] Events: `user.created`, `user.updated`, `user.deleted`
- [ ] Copy Webhook Secret
- [ ] Add to `.env.local`: `CLERK_WEBHOOK_SECRET=whsec_...`

## Files Modified

✅ `apps/web/package.json` - Added `@clerk/nextjs`
✅ `apps/api/package.json` - Added `@clerk/clerk-sdk-node`
✅ `packages/database/prisma/schema.prisma` - Updated User model for Clerk
✅ `apps/web/src/app/layout.tsx` - Added ClerkProvider and UI components
✅ `apps/web/src/lib/clerk.ts` - Helper functions
✅ `middleware.ts` - Clerk authentication middleware
✅ `apps/web/src/app/api/webhooks/clerk/route.ts` - Webhook handler
✅ `.env.example` - Updated with Clerk and NEON env vars

## Verification

Run these commands to verify everything works:

```bash
# Check dependencies installed
pnpm list @clerk/nextjs

# Generate Prisma client
pnpm db:generate

# Verify database connection
pnpm prisma:studio  # Should open UI without errors

# Start development server
pnpm dev

# Check server is running
curl http://localhost:3000
```

## Next: Design Auth Pages

Create professional sign-in/sign-up pages:

```bash
# Create auth directory structure
mkdir -p apps/web/src/app/auth/{sign-in,sign-up}
```

Then create styled pages using Clerk components.

## Next: Protect Routes

All routes are protected by middleware, but create:

- `/auth/sign-in` - Sign in page
- `/auth/sign-up` - Sign up page  
- `/dashboard` - Protected dashboard
- Admin panel for tenant/user management

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Clerk API key not found" | Add env vars to `.env.local` |
| "Database connection refused" | Check NEON URL format ends with `?sslmode=require` |
| "Sign up button missing" | Reload page, check dev console for errors |
| "User not created in database" | Manual create in Prisma Studio or configure webhook |
| "Cannot reach localhost:3000" | Check `pnpm dev` is running: `curl http://localhost:3000` |

## Support

- NEON Help: https://neon.tech/docs/
- Clerk Help: https://clerk.com/docs/
- Issues: Check error logs in terminal with `pnpm dev`
