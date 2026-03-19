-- Multi-tenant signup and onboarding foundation

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "industry" TEXT,
  ADD COLUMN IF NOT EXISTS "size" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Tenant"
  ALTER COLUMN "country" SET DEFAULT 'Nigeria';

ALTER TABLE "WorkSchedule"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';

CREATE INDEX IF NOT EXISTS "Tenant_onboardingComplete_idx" ON "Tenant"("onboardingComplete");
CREATE INDEX IF NOT EXISTS "Tenant_isActive_idx" ON "Tenant"("isActive");
