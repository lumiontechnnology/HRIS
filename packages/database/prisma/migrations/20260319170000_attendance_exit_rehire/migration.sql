-- Attendance + exit + rehire feature foundations

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "terminationDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Attendance"
  ADD COLUMN IF NOT EXISTS "clockInIp" TEXT,
  ADD COLUMN IF NOT EXISTS "clockOutIp" TEXT,
  ADD COLUMN IF NOT EXISTS "workedHours" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "overtimeHours" DECIMAL(5,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Attendance_status_idx" ON "Attendance"("status");

CREATE TABLE IF NOT EXISTS "WorkSchedule" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "workDays" TEXT[] NOT NULL DEFAULT ARRAY['MON','TUE','WED','THU','FRI'],
  "workStart" TEXT NOT NULL DEFAULT '08:00',
  "workEnd" TEXT NOT NULL DEFAULT '17:00',
  "graceMinutes" INTEGER NOT NULL DEFAULT 15,
  "overtimeAfter" DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkSchedule_tenantId_key" ON "WorkSchedule"("tenantId");

INSERT INTO "WorkSchedule" ("id", "tenantId")
SELECT concat('ws_', substr(md5(t.id), 1, 16)), t.id
FROM "Tenant" t
LEFT JOIN "WorkSchedule" ws ON ws."tenantId" = t.id
WHERE ws."id" IS NULL;

CREATE TABLE IF NOT EXISTS "EmployeeExit" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "exitType" TEXT NOT NULL,
  "exitStatus" TEXT NOT NULL DEFAULT 'NOTICE_PERIOD',
  "noticeDate" DATE NOT NULL,
  "lastWorkingDay" DATE NOT NULL,
  "exitReason" TEXT,
  "exitInterviewNotes" TEXT,
  "isEligibleRehire" BOOLEAN NOT NULL DEFAULT true,
  "rehireNotes" TEXT,
  "finalSettlementPaid" BOOLEAN NOT NULL DEFAULT false,
  "finalSettlementDate" DATE,
  "finalSettlementAmount" DECIMAL(15,2),
  "processedByUserId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "EmployeeExit_exitStatus_check"
    CHECK ("exitStatus" IN ('NOTICE_PERIOD','EXITED','REHIRED')),
  CONSTRAINT "EmployeeExit_exitType_check"
    CHECK ("exitType" IN ('RESIGNATION','TERMINATION','REDUNDANCY','RETIREMENT','CONTRACT_END','DEATH','ABANDONMENT','MUTUAL_AGREEMENT'))
);

CREATE INDEX IF NOT EXISTS "EmployeeExit_employeeId_idx" ON "EmployeeExit"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeExit_tenantId_exitStatus_idx" ON "EmployeeExit"("tenantId", "exitStatus");
CREATE INDEX IF NOT EXISTS "EmployeeExit_isEligibleRehire_idx" ON "EmployeeExit"("isEligibleRehire");

CREATE TABLE IF NOT EXISTS "EmploymentHistory" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "stintNumber" INTEGER NOT NULL DEFAULT 1,
  "hireDate" DATE NOT NULL,
  "exitDate" DATE,
  "exitType" TEXT,
  "jobTitle" TEXT,
  "department" TEXT,
  "finalSalary" DECIMAL(15,2),
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EmploymentHistory_tenantId_idx" ON "EmploymentHistory"("tenantId");
CREATE INDEX IF NOT EXISTS "EmploymentHistory_employeeId_stintNumber_idx" ON "EmploymentHistory"("employeeId", "stintNumber");

CREATE TABLE IF NOT EXISTS "OffboardingTask" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "exitRecordId" TEXT,
  "assigneeRole" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "completedBy" TEXT,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "OffboardingTask_status_check" CHECK ("status" IN ('PENDING', 'COMPLETED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS "OffboardingTask_tenantId_status_idx" ON "OffboardingTask"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "OffboardingTask_employeeId_idx" ON "OffboardingTask"("employeeId");

INSERT INTO "EmploymentHistory" (
  "id",
  "tenantId",
  "employeeId",
  "stintNumber",
  "hireDate",
  "exitDate",
  "exitType",
  "jobTitle",
  "department",
  "finalSalary",
  "notes"
)
SELECT
  concat('eh_', substr(md5(e.id), 1, 16)),
  e."tenantId",
  e.id,
  1,
  e."hireDate"::date,
  e."terminationDate"::date,
  CASE WHEN e."terminationDate" IS NULL THEN NULL ELSE 'TERMINATION' END,
  jt.title,
  d.name,
  e.salary,
  'Seeded from existing employee record'
FROM "Employee" e
LEFT JOIN "JobTitle" jt ON jt.id = e."jobTitleId"
LEFT JOIN "Department" d ON d.id = e."departmentId"
LEFT JOIN "EmploymentHistory" h ON h."employeeId" = e.id AND h."stintNumber" = 1
WHERE h.id IS NULL;
