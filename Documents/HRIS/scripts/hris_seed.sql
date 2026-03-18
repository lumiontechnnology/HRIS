-- Seed data for HRIS after schema apply
-- Safe to run once on a clean database.

BEGIN;

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'loc_lag'::text AS lagos_location_id,
    'loc_abj'::text AS abuja_location_id,
    'dept_hr'::text AS dept_hr_id,
    'dept_eng'::text AS dept_eng_id,
    'dept_sales'::text AS dept_sales_id,
    'jt_cto'::text AS jt_cto_id,
    'jt_sr_eng'::text AS jt_sr_eng_id,
    'jt_hr_mgr'::text AS jt_hr_mgr_id,
    'jt_sales_mgr'::text AS jt_sales_mgr_id,
    'user_admin'::text AS user_admin_id,
    'emp_cto'::text AS emp_cto_id,
    'emp_chioma'::text AS emp_chioma_id,
    'emp_tunde'::text AS emp_tunde_id,
    'emp_hr_mgr'::text AS emp_hr_mgr_id,
    'emp_sales_mgr'::text AS emp_sales_mgr_id,
    'lt_annual'::text AS lt_annual_id,
    'lt_sick'::text AS lt_sick_id,
    'lt_maternity'::text AS lt_maternity_id,
    'lb_cto_annual_current'::text AS lb_cto_annual_current_id
)
INSERT INTO "Tenant" (
  "id", "name", "slug", "email", "country", "timezone", "updatedAt"
)
SELECT
  tenant_id,
  'Lumion Technology',
  'lumion-tech',
  'admin@lumiontech.com',
  'Nigeria',
  'Africa/Lagos',
  NOW()
FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'loc_lag'::text AS lagos_location_id,
    'loc_abj'::text AS abuja_location_id
)
INSERT INTO "Location" (
  "id", "tenantId", "name", "code", "city", "country", "timezone", "updatedAt"
)
SELECT lagos_location_id, tenant_id, 'Lagos Office', 'LAG', 'Lagos', 'Nigeria', 'Africa/Lagos', NOW() FROM seed_constants
UNION ALL
SELECT abuja_location_id, tenant_id, 'Abuja Office', 'ABJ', 'Abuja', 'Nigeria', 'Africa/Lagos', NOW() FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'dept_hr'::text AS dept_hr_id,
    'dept_eng'::text AS dept_eng_id,
    'dept_sales'::text AS dept_sales_id
)
INSERT INTO "Department" (
  "id", "tenantId", "name", "code", "updatedAt"
)
SELECT dept_hr_id, tenant_id, 'Human Resources', 'HR', NOW() FROM seed_constants
UNION ALL
SELECT dept_eng_id, tenant_id, 'Engineering', 'ENG', NOW() FROM seed_constants
UNION ALL
SELECT dept_sales_id, tenant_id, 'Sales', 'SALES', NOW() FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'dept_hr'::text AS dept_hr_id,
    'dept_eng'::text AS dept_eng_id,
    'dept_sales'::text AS dept_sales_id,
    'jt_cto'::text AS jt_cto_id,
    'jt_sr_eng'::text AS jt_sr_eng_id,
    'jt_hr_mgr'::text AS jt_hr_mgr_id,
    'jt_sales_mgr'::text AS jt_sales_mgr_id
)
INSERT INTO "JobTitle" (
  "id", "tenantId", "title", "code", "departmentId", "updatedAt"
)
SELECT jt_cto_id, tenant_id, 'Chief Technology Officer', 'CTO', dept_eng_id, NOW() FROM seed_constants
UNION ALL
SELECT jt_sr_eng_id, tenant_id, 'Senior Engineer', 'SR_ENG', dept_eng_id, NOW() FROM seed_constants
UNION ALL
SELECT jt_hr_mgr_id, tenant_id, 'HR Manager', 'HR_MGR', dept_hr_id, NOW() FROM seed_constants
UNION ALL
SELECT jt_sales_mgr_id, tenant_id, 'Sales Manager', 'SALES_MGR', dept_sales_id, NOW() FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'user_admin'::text AS user_admin_id,
    'tenant_lumion_tech'::text AS tenant_id
)
INSERT INTO "User" (
  "id", "authUserId", "email", "firstName", "lastName", "tenantId", "isActive", "updatedAt"
)
SELECT
  user_admin_id,
  'auth_admin_lumion',
  'admin@lumiontech.com',
  'Admin',
  'User',
  tenant_id,
  TRUE,
  NOW()
FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'loc_lag'::text AS lagos_location_id,
    'loc_abj'::text AS abuja_location_id,
    'dept_hr'::text AS dept_hr_id,
    'dept_eng'::text AS dept_eng_id,
    'dept_sales'::text AS dept_sales_id,
    'jt_cto'::text AS jt_cto_id,
    'jt_sr_eng'::text AS jt_sr_eng_id,
    'jt_hr_mgr'::text AS jt_hr_mgr_id,
    'jt_sales_mgr'::text AS jt_sales_mgr_id,
    'emp_cto'::text AS emp_cto_id,
    'emp_chioma'::text AS emp_chioma_id,
    'emp_tunde'::text AS emp_tunde_id,
    'emp_hr_mgr'::text AS emp_hr_mgr_id,
    'emp_sales_mgr'::text AS emp_sales_mgr_id
)
INSERT INTO "Employee" (
  "id", "tenantId", "employeeId", "firstName", "lastName", "email", "phone", "hireDate",
  "employmentType", "employmentStatus", "jobTitleId", "departmentId", "locationId", "managerId",
  "salary", "currency", "salaryFrequency", "updatedAt"
)
SELECT
  emp_cto_id, tenant_id, 'LMN-0001', 'John', 'Okonkwo', 'cto@lumiontech.com', '+2348000000001',
  '2022-01-15'::timestamp,
  'FULL_TIME', 'ACTIVE', jt_cto_id, dept_eng_id, lagos_location_id, NULL,
  5000000, 'NGN', 'MONTHLY', NOW()
FROM seed_constants
UNION ALL
SELECT
  emp_chioma_id, tenant_id, 'LMN-0002', 'Chioma', 'Adeyemi', 'chioma.adeyemi@lumiontech.com', '+2348000000002',
  '2022-06-01'::timestamp,
  'FULL_TIME', 'ACTIVE', jt_sr_eng_id, dept_eng_id, lagos_location_id, emp_cto_id,
  3000000, 'NGN', 'MONTHLY', NOW()
FROM seed_constants
UNION ALL
SELECT
  emp_tunde_id, tenant_id, 'LMN-0003', 'Tunde', 'Okafor', 'tunde.okafor@lumiontech.com', '+2348000000003',
  '2023-02-01'::timestamp,
  'FULL_TIME', 'ACTIVE', jt_sr_eng_id, dept_eng_id, lagos_location_id, emp_cto_id,
  2800000, 'NGN', 'MONTHLY', NOW()
FROM seed_constants
UNION ALL
SELECT
  emp_hr_mgr_id, tenant_id, 'LMN-0004', 'Blessing', 'Okafor', 'blessing.okafor@lumiontech.com', '+2348000000004',
  '2022-03-15'::timestamp,
  'FULL_TIME', 'ACTIVE', jt_hr_mgr_id, dept_hr_id, lagos_location_id, NULL,
  2200000, 'NGN', 'MONTHLY', NOW()
FROM seed_constants
UNION ALL
SELECT
  emp_sales_mgr_id, tenant_id, 'LMN-0005', 'Amara', 'Ngoako', 'amara.ngoako@lumiontech.com', '+2348000000005',
  '2023-01-10'::timestamp,
  'FULL_TIME', 'ACTIVE', jt_sales_mgr_id, dept_sales_id, abuja_location_id, NULL,
  2500000, 'NGN', 'MONTHLY', NOW()
FROM seed_constants;

UPDATE "Employee"
SET "confirmationDate" = '2022-06-15'::timestamp
WHERE "id" = 'emp_hr_mgr';

WITH seed_constants AS (
  SELECT
    'tenant_lumion_tech'::text AS tenant_id,
    'lt_annual'::text AS lt_annual_id,
    'lt_sick'::text AS lt_sick_id,
    'lt_maternity'::text AS lt_maternity_id
)
INSERT INTO "LeaveType" (
  "id", "tenantId", "name", "code", "requiresApproval", "requiresDocumentation", "isGenderRestricted",
  "maxConsecutiveDays", "carryoverLimit", "carryoverExpiry", "updatedAt"
)
SELECT lt_annual_id, tenant_id, 'Annual Leave', 'ANNUAL', TRUE, FALSE, FALSE, 30, 5, 365, NOW() FROM seed_constants
UNION ALL
SELECT lt_sick_id, tenant_id, 'Sick Leave', 'SICK', TRUE, TRUE, FALSE, 5, NULL, NULL, NOW() FROM seed_constants
UNION ALL
SELECT lt_maternity_id, tenant_id, 'Maternity Leave', 'MATERNITY', TRUE, FALSE, TRUE, 90, NULL, NULL, NOW() FROM seed_constants;

WITH seed_constants AS (
  SELECT
    'lb_cto_annual_current'::text AS leave_balance_id,
    'tenant_lumion_tech'::text AS tenant_id,
    'emp_cto'::text AS employee_id,
    'lt_annual'::text AS leave_type_id
)
INSERT INTO "LeaveBalance" (
  "id", "tenantId", "employeeId", "leaveTypeId", "year", "available", "taken", "carried", "updatedAt"
)
SELECT
  leave_balance_id,
  tenant_id,
  employee_id,
  leave_type_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  21,
  0,
  0,
  NOW()
FROM seed_constants;

COMMIT;
