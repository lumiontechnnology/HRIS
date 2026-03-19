import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import { Role } from '@lumion/types';
import { createPerformanceRoutes } from './performance.js';
import { createTrainingRoutes } from './training.js';
import type { AppEnv } from '../index.js';

function createTenantAwareApp() {
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
      roles: [Role.HR_ADMIN],
      permissions: [],
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await next();
  });

  return app;
}

test('performance summary returns computed distribution', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;

  const originalGoalCount = prismaMock.goal?.count;
  const originalReviewCount = prismaMock.performanceReview?.count;
  const originalReviewGroupBy = prismaMock.performanceReview?.groupBy;

  prismaMock.goal = prismaMock.goal || {};
  prismaMock.performanceReview = prismaMock.performanceReview || {};

  let goalCountCall = 0;
  prismaMock.goal.count = async () => {
    goalCountCall += 1;
    if (goalCountCall === 1) return 10;
    if (goalCountCall === 2) return 7;
    if (goalCountCall === 3) return 2;
    return 1;
  };

  let reviewCountCall = 0;
  prismaMock.performanceReview.count = async () => {
    reviewCountCall += 1;
    if (reviewCountCall === 1) return 5;
    return 2;
  };

  prismaMock.performanceReview.groupBy = async () => [
    { managerRating: 5, _count: { id: 2 } },
    { managerRating: 3, _count: { id: 1 } },
    { managerRating: 2, _count: { id: 1 } },
  ];

  const app = createTenantAwareApp();
  app.route('/api/v1/performance', createPerformanceRoutes());

  const response = await app.request('http://localhost/api/v1/performance/summary');
  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.goalsTotal, 10);
  assert.equal(body.data.reviewsTotal, 5);
  assert.equal(body.data.distribution.length, 3);
  assert.equal(body.data.distribution[0].label, 'High');

  prismaMock.goal.count = originalGoalCount;
  prismaMock.performanceReview.count = originalReviewCount;
  prismaMock.performanceReview.groupBy = originalReviewGroupBy;
});

test('training enrollments returns paginated live rows', async () => {
  const prismaMock = prisma as unknown as Record<string, any>;
  const originalFindMany = prismaMock.trainingEnrollment?.findMany;
  const originalCount = prismaMock.trainingEnrollment?.count;

  prismaMock.trainingEnrollment = prismaMock.trainingEnrollment || {};
  prismaMock.trainingEnrollment.findMany = async () => [
    {
      id: 'enr-1',
      status: 'IN_PROGRESS',
      employee: { id: 'emp-1', firstName: 'Ada', lastName: 'Lovelace', employeeId: 'LMN-0001' },
      training: {
        id: 'tr-1',
        title: 'Advanced Payroll Compliance',
        provider: 'Finance Guild',
        type: 'EXTERNAL',
        startDate: new Date(),
        endDate: null,
      },
    },
  ];
  prismaMock.trainingEnrollment.count = async () => 1;

  const app = createTenantAwareApp();
  app.route('/api/v1/training', createTrainingRoutes());

  const response = await app.request('http://localhost/api/v1/training/enrollments?limit=20&page=1');
  const body = (await response.json()) as any;

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].training.title, 'Advanced Payroll Compliance');
  assert.equal(body.meta.total, 1);

  prismaMock.trainingEnrollment.findMany = originalFindMany;
  prismaMock.trainingEnrollment.count = originalCount;
});
