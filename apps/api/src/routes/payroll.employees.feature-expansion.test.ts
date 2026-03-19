import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import { Role } from '@lumion/types';
import { createPayrollRoutes } from './payroll.js';
import { createEmployeeRoutes } from './employees.js';
import type { AppEnv } from '../index.js';

function withAuth(role: Role) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('tenantId', 'tenant-1');
    c.set('userId', 'user-1');
    c.set('user', {
      id: 'user-1',
      email: 'tester@lumion.com',
      firstName: 'Test',
      lastName: 'User',
      tenantId: 'tenant-1',
      roles: [role],
      permissions: [],
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await next();
  });
  return app;
}

test('payroll approve blocks user with wrong role for current step', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalFindFirst = prismaMock.payrollRun?.findFirst;
  const originalQueryRawUnsafe = prismaMock.$queryRawUnsafe;

  prismaMock.payrollRun = prismaMock.payrollRun || {};

  prismaMock.payrollRun.findFirst = async () => ({
    id: 'run-1',
    tenantId: 'tenant-1',
    status: 'PENDING_HR',
    period: '2026-03',
    payslips: [],
  });

  prismaMock.$queryRawUnsafe = async () => [
    {
      id: 'step-1',
      payroll_run_id: 'run-1',
      step: 1,
      role_required: 'HR_ADMIN',
      action: 'PENDING',
      approved_by: null,
      note: null,
      actioned_at: null,
      created_at: new Date(),
    },
  ];

  const app = withAuth(Role.MANAGER);
  app.route('/api/v1/payroll', createPayrollRoutes());

  const response = await app.request('http://localhost/api/v1/payroll/runs/run-1/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FORBIDDEN');

  prismaMock.payrollRun.findFirst = originalFindFirst;
  prismaMock.$queryRawUnsafe = originalQueryRawUnsafe;
});

test('employee CSV import returns all validation errors and inserts nothing on invalid file', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalDepartmentFindMany = prismaMock.department?.findMany;
  const originalJobTitleFindMany = prismaMock.jobTitle?.findMany;
  const originalLocationFindMany = prismaMock.location?.findMany;
  const originalEmployeeFindMany = prismaMock.employee?.findMany;
  const originalEmployeeCreate = prismaMock.employee?.create;

  prismaMock.department = prismaMock.department || {};
  prismaMock.jobTitle = prismaMock.jobTitle || {};
  prismaMock.location = prismaMock.location || {};
  prismaMock.employee = prismaMock.employee || {};

  prismaMock.department.findMany = async () => [{ id: 'dept-1', name: 'Engineering' }];
  prismaMock.jobTitle.findMany = async () => [{ id: 'job-1', title: 'Software Engineer' }];
  prismaMock.location.findMany = async () => [{ id: 'loc-1', name: 'Lagos' }];
  prismaMock.employee.findMany = async () => [{ id: 'emp-1', email: 'manager@lumion.com' }];

  let createCalled = 0;
  prismaMock.employee.create = async () => {
    createCalled += 1;
    return { id: 'new-employee' };
  };

  const csv = [
    'employee_id,first_name,middle_name,last_name,email,personal_email,phone,date_of_birth,gender,marital_status,nationality,national_id,hire_date,employment_type,job_title,department,location,manager_email,salary,currency,salary_frequency,address_street,address_city,address_state,address_country,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,bank_name,account_number,account_name,sort_code',
    ',,,User,bad-email,,,,INVALID,,,,,2026-03-20,INVALID_TYPE,Unknown Job,Unknown Department,Unknown City,missing@lumion.com,1000,NGN,YEARLY,,,,,,,,,,',
  ].join('\n');

  const form = new FormData();
  form.append('csv', new File([csv], 'employees.csv', { type: 'text/csv' }));

  const app = withAuth(Role.HR_ADMIN);
  app.route('/api/v1/employees', createEmployeeRoutes());

  const response = await app.request('http://localhost/api/v1/employees/import', {
    method: 'POST',
    body: form,
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 422);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors));
  assert.ok(body.errors.length >= 6);
  assert.equal(createCalled, 0);

  prismaMock.department.findMany = originalDepartmentFindMany;
  prismaMock.jobTitle.findMany = originalJobTitleFindMany;
  prismaMock.location.findMany = originalLocationFindMany;
  prismaMock.employee.findMany = originalEmployeeFindMany;
  prismaMock.employee.create = originalEmployeeCreate;
});

// ─── Approval chain ordering ──────────────────────────────────────────────────

test('payroll approve blocks HEAD_OF_HR from acting on step 1 (requires HR_ADMIN)', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalFindFirst = prismaMock.payrollRun?.findFirst;
  const originalQueryRawUnsafe = prismaMock.$queryRawUnsafe;

  prismaMock.payrollRun = prismaMock.payrollRun || {};

  prismaMock.payrollRun.findFirst = async () => ({
    id: 'run-2',
    tenantId: 'tenant-1',
    status: 'PENDING_HR',
    period: '2026-03',
    payslips: [],
  });

  prismaMock.$queryRawUnsafe = async () => [
    {
      id: 'step-2',
      payroll_run_id: 'run-2',
      step: 1,
      role_required: 'HR_ADMIN',
      action: 'PENDING',
      approved_by: null,
      note: null,
      actioned_at: null,
      created_at: new Date(),
    },
  ];

  const app = withAuth(Role.HEAD_OF_HR);
  app.route('/api/v1/payroll', createPayrollRoutes());

  const response = await app.request('http://localhost/api/v1/payroll/runs/run-2/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FORBIDDEN');

  prismaMock.payrollRun.findFirst = originalFindFirst;
  prismaMock.$queryRawUnsafe = originalQueryRawUnsafe;
});

test('payroll approve blocks FINANCE_OFFICER from acting on step 2 (requires HEAD_OF_HR)', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalFindFirst = prismaMock.payrollRun?.findFirst;
  const originalQueryRawUnsafe = prismaMock.$queryRawUnsafe;

  prismaMock.payrollRun = prismaMock.payrollRun || {};

  prismaMock.payrollRun.findFirst = async () => ({
    id: 'run-3',
    tenantId: 'tenant-1',
    status: 'PENDING_HEAD_OF_HR',
    period: '2026-03',
    payslips: [],
  });

  prismaMock.$queryRawUnsafe = async () => [
    {
      id: 'step-3',
      payroll_run_id: 'run-3',
      step: 2,
      role_required: 'HEAD_OF_HR',
      action: 'PENDING',
      approved_by: null,
      note: null,
      actioned_at: null,
      created_at: new Date(),
    },
  ];

  const app = withAuth(Role.FINANCE_OFFICER);
  app.route('/api/v1/payroll', createPayrollRoutes());

  const response = await app.request('http://localhost/api/v1/payroll/runs/run-3/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');

  prismaMock.payrollRun.findFirst = originalFindFirst;
  prismaMock.$queryRawUnsafe = originalQueryRawUnsafe;
});

test('payroll approve blocks action when run is not in a pending approval state', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalFindFirst = prismaMock.payrollRun?.findFirst;
  const originalQueryRawUnsafe = prismaMock.$queryRawUnsafe;

  prismaMock.payrollRun = prismaMock.payrollRun || {};

  prismaMock.payrollRun.findFirst = async () => ({
    id: 'run-4',
    tenantId: 'tenant-1',
    status: 'DRAFT',
    period: '2026-03',
    payslips: [],
  });

  prismaMock.$queryRawUnsafe = async () => [];

  const app = withAuth(Role.HR_ADMIN);
  app.route('/api/v1/payroll', createPayrollRoutes());

  const response = await app.request('http://localhost/api/v1/payroll/runs/run-4/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_STATE');

  prismaMock.payrollRun.findFirst = originalFindFirst;
  prismaMock.$queryRawUnsafe = originalQueryRawUnsafe;
});

test('payroll SUPER_ADMIN can approve any step regardless of role_required', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalFindFirst = prismaMock.payrollRun?.findFirst;
  const originalQueryRawUnsafe = prismaMock.$queryRawUnsafe;
  const originalExecuteRaw = prismaMock.$executeRawUnsafe;
  const originalUpdate = prismaMock.payrollRun?.update;
  const originalFindUnique = prismaMock.user?.findUnique;
  const originalFindMany = prismaMock.user?.findMany;
  const originalAuditCreate = prismaMock.auditLog?.create;
  const originalPayslipUpdateMany = prismaMock.payslip?.updateMany;

  prismaMock.payrollRun = prismaMock.payrollRun || {};
  prismaMock.user = prismaMock.user || {};
  prismaMock.auditLog = prismaMock.auditLog || {};
  prismaMock.payslip = prismaMock.payslip || {};

  prismaMock.payrollRun.findFirst = async () => ({
    id: 'run-5',
    tenantId: 'tenant-1',
    status: 'PENDING_AUDIT',
    period: '2026-03',
    payslips: [],
  });

  // Pending step at PAYROLL_AUDITOR level — SUPER_ADMIN should bypass this
  prismaMock.$queryRawUnsafe = async () => [
    {
      id: 'step-5',
      payroll_run_id: 'run-5',
      step: 3,
      role_required: 'PAYROLL_AUDITOR',
      action: 'PENDING',
      approved_by: null,
      note: null,
      actioned_at: null,
      created_at: new Date(),
    },
  ];

  prismaMock.payrollRun.update = async () => ({ id: 'run-5', status: 'PENDING_FINANCE' });
  prismaMock.$executeRawUnsafe = async () => 1;
  prismaMock.user.findUnique = async () => ({ firstName: 'Super', lastName: 'Admin' });
  prismaMock.user.findMany = async () => [];
  prismaMock.auditLog.create = async () => ({});
  prismaMock.payslip.updateMany = async () => ({});

  const app = withAuth(Role.SUPER_ADMIN);
  app.route('/api/v1/payroll', createPayrollRoutes());

  const response = await app.request('http://localhost/api/v1/payroll/runs/run-5/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ note: 'SUPER_ADMIN override' }),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);

  prismaMock.payrollRun.findFirst = originalFindFirst;
  prismaMock.$queryRawUnsafe = originalQueryRawUnsafe;
  prismaMock.$executeRawUnsafe = originalExecuteRaw;
  prismaMock.payrollRun.update = originalUpdate;
  prismaMock.user.findUnique = originalFindUnique;
  prismaMock.user.findMany = originalFindMany;
  prismaMock.auditLog.create = originalAuditCreate;
  prismaMock.payslip.updateMany = originalPayslipUpdateMany;
});

// ─── CSV all-or-nothing ───────────────────────────────────────────────────────

test('CSV import with all valid rows inserts every record and returns 200', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalDepartmentFindMany = prismaMock.department?.findMany;
  const originalJobTitleFindMany = prismaMock.jobTitle?.findMany;
  const originalLocationFindMany = prismaMock.location?.findMany;
  const originalEmployeeFindMany = prismaMock.employee?.findMany;
  const originalEmployeeCreate = prismaMock.employee?.create;

  prismaMock.department = prismaMock.department || {};
  prismaMock.jobTitle = prismaMock.jobTitle || {};
  prismaMock.location = prismaMock.location || {};
  prismaMock.employee = prismaMock.employee || {};

  prismaMock.department.findMany = async () => [{ id: 'dept-1', name: 'Engineering' }];
  prismaMock.jobTitle.findMany = async () => [{ id: 'job-1', title: 'Software Engineer' }];
  prismaMock.location.findMany = async () => [{ id: 'loc-1', name: 'Lagos' }];
  prismaMock.employee.findMany = async () => [{ id: 'mgr-1', email: 'manager@lumion.com' }];
  prismaMock.employee.count = async () => 10;

  prismaMock.address = prismaMock.address || {};
  prismaMock.emergencyContact = prismaMock.emergencyContact || {};
  prismaMock.leaveType = prismaMock.leaveType || {};
  prismaMock.leaveBalance = prismaMock.leaveBalance || {};
  const originalEmployeeCount = prismaMock.employee?.count;
  const originalAddressCreate = prismaMock.address?.create;
  const originalEmergencyCreate = prismaMock.emergencyContact?.create;
  const originalLeaveTypeFindMany = prismaMock.leaveType?.findMany;
  const originalLeaveBalanceCreateMany = prismaMock.leaveBalance?.createMany;

  prismaMock.address.create = async () => ({});
  prismaMock.emergencyContact.create = async () => ({});
  prismaMock.leaveType.findMany = async () => [];
  prismaMock.leaveBalance.createMany = async () => ({});

  const created: string[] = [];
  prismaMock.employee.create = async (args: any) => {
    const id = `emp-${created.length + 1}`;
    created.push(id);
    return { id, ...args.data };
  };

  prismaMock.auditLog = prismaMock.auditLog || {};
  const originalAuditCreate = prismaMock.auditLog?.create;
  prismaMock.auditLog.create = async () => ({});

  const rows = [
    'employee_id,first_name,middle_name,last_name,email,personal_email,phone,date_of_birth,gender,marital_status,nationality,national_id,hire_date,employment_type,job_title,department,location,manager_email,salary,currency,salary_frequency,address_street,address_city,address_state,address_country,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,bank_name,account_number,account_name,sort_code',
    'LMN-0010,Alice,,Smith,alice@lumion.com,,+2341234567890,1990-01-15,FEMALE,SINGLE,Nigerian,,2024-01-10,FULL_TIME,Software Engineer,Engineering,Lagos,manager@lumion.com,500000,NGN,MONTHLY,10 Main St,Lagos,Lagos,Nigeria,Bob Smith,+2340987654321,Spouse,,,,',
    'LMN-0011,Bob,,Jones,bob@lumion.com,,+2341234567891,1988-06-20,MALE,MARRIED,Nigerian,,2024-02-01,FULL_TIME,Software Engineer,Engineering,Lagos,manager@lumion.com,600000,NGN,MONTHLY,20 Side Ave,Lagos,Lagos,Nigeria,Carol Jones,+2340987654322,Spouse,,,,',
  ];

  const csv = rows.join('\n');
  const form = new FormData();
  form.append('csv', new File([csv], 'employees.csv', { type: 'text/csv' }));

  const app = withAuth(Role.HR_ADMIN);
  app.route('/api/v1/employees', createEmployeeRoutes());

  const response = await app.request('http://localhost/api/v1/employees/import', {
    method: 'POST',
    body: form,
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(created.length, 2, 'both rows should be inserted');

  prismaMock.department.findMany = originalDepartmentFindMany;
  prismaMock.jobTitle.findMany = originalJobTitleFindMany;
  prismaMock.location.findMany = originalLocationFindMany;
  prismaMock.employee.findMany = originalEmployeeFindMany;
  prismaMock.employee.create = originalEmployeeCreate;
  prismaMock.employee.count = originalEmployeeCount;
  prismaMock.address.create = originalAddressCreate;
  prismaMock.emergencyContact.create = originalEmergencyCreate;
  prismaMock.leaveType.findMany = originalLeaveTypeFindMany;
  prismaMock.leaveBalance.createMany = originalLeaveBalanceCreateMany;
  prismaMock.auditLog.create = originalAuditCreate;
});

test('CSV import with mix of valid and invalid rows inserts nothing (all-or-nothing)', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalDepartmentFindMany = prismaMock.department?.findMany;
  const originalJobTitleFindMany = prismaMock.jobTitle?.findMany;
  const originalLocationFindMany = prismaMock.location?.findMany;
  const originalEmployeeFindMany = prismaMock.employee?.findMany;
  const originalEmployeeCreate = prismaMock.employee?.create;

  prismaMock.department = prismaMock.department || {};
  prismaMock.jobTitle = prismaMock.jobTitle || {};
  prismaMock.location = prismaMock.location || {};
  prismaMock.employee = prismaMock.employee || {};

  prismaMock.department.findMany = async () => [{ id: 'dept-1', name: 'Engineering' }];
  prismaMock.jobTitle.findMany = async () => [{ id: 'job-1', title: 'Software Engineer' }];
  prismaMock.location.findMany = async () => [{ id: 'loc-1', name: 'Lagos' }];
  prismaMock.employee.findMany = async () => [];

  let createCalled = 0;
  prismaMock.employee.create = async () => {
    createCalled += 1;
    return { id: 'new-emp' };
  };

  const rows = [
    'employee_id,first_name,middle_name,last_name,email,personal_email,phone,date_of_birth,gender,marital_status,nationality,national_id,hire_date,employment_type,job_title,department,location,manager_email,salary,currency,salary_frequency,address_street,address_city,address_state,address_country,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,bank_name,account_number,account_name,sort_code',
    // valid row
    'LMN-0020,Diana,,Prince,diana@lumion.com,,+2341111111111,1992-03-10,FEMALE,SINGLE,Nigerian,,2024-03-01,FULL_TIME,Software Engineer,Engineering,Lagos,,450000,NGN,MONTHLY,,,,,,,,,,,',
    // invalid row — bad email + unknown employment type
    ',,,Ghost,not-an-email,,,,INVALID,,,,,2026-03-20,UNKNOWN_TYPE,Unknown,Unknown Dept,Unknown City,,1000,NGN,YEARLY,,,,,,,,,,',
  ];

  const csv = rows.join('\n');
  const form = new FormData();
  form.append('csv', new File([csv], 'employees.csv', { type: 'text/csv' }));

  const app = withAuth(Role.HR_ADMIN);
  app.route('/api/v1/employees', createEmployeeRoutes());

  const response = await app.request('http://localhost/api/v1/employees/import', {
    method: 'POST',
    body: form,
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 422);
  assert.equal(body.success, false);
  assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
  assert.equal(createCalled, 0, 'no records must be inserted when any row fails validation');

  prismaMock.department.findMany = originalDepartmentFindMany;
  prismaMock.jobTitle.findMany = originalJobTitleFindMany;
  prismaMock.location.findMany = originalLocationFindMany;
  prismaMock.employee.findMany = originalEmployeeFindMany;
  prismaMock.employee.create = originalEmployeeCreate;
});
