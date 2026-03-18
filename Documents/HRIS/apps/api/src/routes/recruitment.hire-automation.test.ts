import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import { createRecruitmentRoutes } from './recruitment.js';

test('recruitment status HIRED triggers employee creation automation', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalApplicationFindFirst = prismaMock.application?.findFirst;
  const originalApplicationUpdate = prismaMock.application?.update;
  const originalEmployeeFindFirst = prismaMock.employee?.findFirst;
  const originalEmployeeCount = prismaMock.employee?.count;
  const originalEmployeeCreate = prismaMock.employee?.create;
  const originalLocationFindFirst = prismaMock.location?.findFirst;
  const originalDepartmentFindFirst = prismaMock.department?.findFirst;
  const originalNotificationCreate = prismaMock.notification?.create;
  const originalAuditCreate = prismaMock.auditLog?.create;

  prismaMock.application = prismaMock.application || {};
  prismaMock.employee = prismaMock.employee || {};
  prismaMock.location = prismaMock.location || {};
  prismaMock.department = prismaMock.department || {};
  prismaMock.notification = prismaMock.notification || {};
  prismaMock.auditLog = prismaMock.auditLog || {};

  let applicationFindFirstCalls = 0;

  prismaMock.application.findFirst = async () => {
    applicationFindFirstCalls += 1;

    if (applicationFindFirstCalls === 1) {
      return {
        id: 'app-1',
        tenantId: 'tenant-1',
        status: 'APPLIED',
      };
    }

    return {
      id: 'app-1',
      tenantId: 'tenant-1',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@lumion.com',
      phone: '+2348000000000',
      jobRequisition: {
        id: 'job-1',
        tenantId: 'tenant-1',
        jobTitleId: 'job-title-1',
        departmentId: 'dept-1',
        salary_min: 1000000,
        salary_max: 1500000,
        currency: 'NGN',
      },
    };
  };

  prismaMock.application.update = async () => ({
    id: 'app-1',
    tenantId: 'tenant-1',
    firstName: 'Grace',
    lastName: 'Hopper',
    status: 'HIRED',
    currentStage: 'HIRED',
    jobRequisition: { id: 'job-1' },
    interviews: [],
  });

  prismaMock.employee.findFirst = async () => null;
  prismaMock.employee.count = async () => 12;
  prismaMock.employee.create = async () => ({ id: 'emp-13' });
  prismaMock.location.findFirst = async () => ({ id: 'loc-1' });
  prismaMock.department.findFirst = async () => ({ id: 'dept-1' });
  prismaMock.notification.create = async () => ({ id: 'ntf-1' });
  prismaMock.auditLog.create = async () => ({ id: 'log-1' });

  const app = new Hono();
  app.route('/api/v1/recruitment', createRecruitmentRoutes());

  const response = await app.request('http://localhost/api/v1/recruitment/applications/app-1', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'tenant-1',
      'x-user-id': 'user-1',
    },
    body: JSON.stringify({ status: 'HIRED' }),
  });

  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'HIRED');
  assert.equal(body.meta.hireAutomation.created, true);
  assert.equal(body.meta.hireAutomation.employeeId, 'emp-13');

  prismaMock.application.findFirst = originalApplicationFindFirst;
  prismaMock.application.update = originalApplicationUpdate;
  prismaMock.employee.findFirst = originalEmployeeFindFirst;
  prismaMock.employee.count = originalEmployeeCount;
  prismaMock.employee.create = originalEmployeeCreate;
  prismaMock.location.findFirst = originalLocationFindFirst;
  prismaMock.department.findFirst = originalDepartmentFindFirst;
  prismaMock.notification.create = originalNotificationCreate;
  prismaMock.auditLog.create = originalAuditCreate;
});
