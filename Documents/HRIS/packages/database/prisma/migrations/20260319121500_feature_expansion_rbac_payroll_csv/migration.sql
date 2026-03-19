-- Feature expansion migration: RBAC, payroll approval chain, and profile-change workflow.

-- Role assignment history for audit trails.
CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS role_assignments_user_revoked_idx
  ON role_assignments(user_id, revoked_at);

-- Payroll approval step log independent of Prisma enum constraints.
CREATE TABLE IF NOT EXISTS payroll_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payroll_run_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  role_required TEXT NOT NULL,
  approved_by TEXT,
  action TEXT NOT NULL DEFAULT 'PENDING',
  note TEXT,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_approvals_action_check CHECK (action IN ('APPROVED', 'REJECTED', 'PENDING'))
);

CREATE INDEX IF NOT EXISTS payroll_approvals_run_step_idx
  ON payroll_approvals(payroll_run_id, step);

-- Support rejection metadata and role handoff in payroll runs.
ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "currentApproverRole" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- Employee profile sensitive field change workflow.
CREATE TABLE IF NOT EXISTS profile_change_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  fields JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_change_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS profile_change_requests_employee_status_idx
  ON profile_change_requests(employee_id, status);
