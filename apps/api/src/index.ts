import { Context, Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prisma } from '@lumion/database';

// Middleware
import type { MiddlewareHandler } from 'hono';
import { type AuthUser } from '@lumion/types';
import { verifyAuth } from './lib/auth/verify.js';

// Route handlers
import { createEmployeeRoutes } from './routes/employees.js';
import { createLeaveRoutes } from './routes/leave.js';
import { createAttendanceRoutes } from './routes/attendance.js';
import { createPayrollRoutes } from './routes/payroll.js';
import { createRecruitmentRoutes } from './routes/recruitment.js';
import { createPerformanceRoutes } from './routes/performance.js';
import { createTrainingRoutes } from './routes/training.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createNotificationRoutes } from './routes/notifications.js';
import { createHealthRoutes } from './routes/health.js';
import { createAdminRoleRoutes } from './routes/admin-roles.js';
import { createMeRoutes } from './routes/me.js';
import { createManagerRoutes } from './routes/manager.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AppEnv {
  Variables: {
    userId: string;
    tenantId: string;
    user: AuthUser;
  };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authUser = await verifyAuth(c.req.raw);
  const fallbackUserId = c.req.header('x-user-id') || undefined;
  const fallbackTenantId = c.req.header('x-tenant-id') || undefined;

  let userRecord = authUser
    ? await prisma.user.findUnique({
        where: { authUserId: authUser.id },
        include: { roles: true },
      })
    : fallbackUserId && fallbackTenantId
      ? await prisma.user.findFirst({
          where: { id: fallbackUserId, tenantId: fallbackTenantId },
          include: { roles: true },
        })
      : null;

  if (!userRecord) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Ensure every tenant has a SUPER_ADMIN and first authenticated user is promoted if none exists.
  const superAdminCount = await prisma.user.count({
    where: {
      tenantId: userRecord.tenantId,
      roles: {
        some: { name: 'SUPER_ADMIN' },
      },
    },
  });

  if (superAdminCount === 0) {
    const superAdminRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: userRecord.tenantId, name: 'SUPER_ADMIN' } },
      update: {},
      create: {
        tenantId: userRecord.tenantId,
        name: 'SUPER_ADMIN',
        description: 'Tenant owner and primary administrator',
        isBuiltIn: true,
      },
    });

    await prisma.user.update({
      where: { id: userRecord.id },
      data: {
        roles: {
          set: [],
          connect: [{ id: superAdminRole.id }],
        },
      },
    });

    userRecord = await prisma.user.findUnique({
      where: { id: userRecord.id },
      include: { roles: true },
    });
  } else if (userRecord.roles.length === 0) {
    const employeeRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: userRecord.tenantId, name: 'EMPLOYEE' } },
      update: {},
      create: {
        tenantId: userRecord.tenantId,
        name: 'EMPLOYEE',
        description: 'Default employee role',
        isBuiltIn: true,
      },
    });

    await prisma.user.update({
      where: { id: userRecord.id },
      data: {
        roles: {
          set: [],
          connect: [{ id: employeeRole.id }],
        },
      },
    });

    userRecord = await prisma.user.findUnique({
      where: { id: userRecord.id },
      include: { roles: true },
    });
  }

  if (!userRecord) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rolesFromJoin = userRecord.roles.map((role) => role.name);
  const normalizedRoles = rolesFromJoin.length > 0 ? rolesFromJoin : ['EMPLOYEE'];

  const appUser: AuthUser = {
    id: userRecord.id,
    email: userRecord.email,
    firstName: userRecord.firstName,
    lastName: userRecord.lastName,
    tenantId: userRecord.tenantId,
    roles: normalizedRoles as AuthUser['roles'],
    permissions: [],
    mfaEnabled: false,
    lastLogin: userRecord.lastLogin ?? undefined,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
  };

  c.set('userId', userRecord.id);
  c.set('tenantId', userRecord.tenantId);
  c.set('user', appUser);

  await next();
};

const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: 'Tenant not found' }, 400);
  }
  await next();
};

// ============================================================================
// APP SETUP
// ============================================================================

const app = new Hono<AppEnv>();

// Global middleware
app.use(logger());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Health check routes
app.route('/health', createHealthRoutes());

// API routes
app.use('/api/v1/*', authMiddleware);
app.use('/api/v1/*', tenantMiddleware);
app.route('/api/v1/employees', createEmployeeRoutes());
app.route('/api/v1/leave-requests', createLeaveRoutes());
app.route('/api/v1/attendance', createAttendanceRoutes());
app.route('/api/v1/payroll', createPayrollRoutes());
app.route('/api/v1/recruitment', createRecruitmentRoutes());
app.route('/api/v1/performance', createPerformanceRoutes());
app.route('/api/v1/training', createTrainingRoutes());
app.route('/api/v1/dashboard', createDashboardRoutes());
app.route('/api/v1/notifications', createNotificationRoutes());
app.route('/api/v1/admin', createAdminRoleRoutes());
app.route('/api/v1/me', createMeRoutes());
app.route('/api/v1/manager', createManagerRoutes());

async function proxyToPayroll(c: Context<AppEnv>, targetPath: string) {
  const url = new URL(c.req.url);
  url.pathname = targetPath;

  const requestInit: RequestInit = {
    method: c.req.method,
    headers: new Headers(c.req.raw.headers),
  };

  if (!['GET', 'HEAD'].includes(c.req.method.toUpperCase())) {
    requestInit.body = await c.req.raw.arrayBuffer();
  }

  return app.fetch(new Request(url.toString(), requestInit), c.env, c.executionCtx);
}

app.get('/api/v1/settings/payroll-components', (c) => proxyToPayroll(c, '/api/v1/payroll/settings/payroll-components'));
app.post('/api/v1/settings/payroll-components', (c) => proxyToPayroll(c, '/api/v1/payroll/settings/payroll-components'));
app.patch('/api/v1/settings/payroll-components/:id', (c) =>
  proxyToPayroll(c, `/api/v1/payroll/settings/payroll-components/${c.req.param('id')}`)
);
app.delete('/api/v1/settings/payroll-components/:id', (c) =>
  proxyToPayroll(c, `/api/v1/payroll/settings/payroll-components/${c.req.param('id')}`)
);
app.post('/api/v1/settings/payroll-components/:id/bulk-assign', (c) =>
  proxyToPayroll(c, `/api/v1/payroll/settings/payroll-components/${c.req.param('id')}/bulk-assign`)
);

app.get('/api/v1/employees/:id/components', (c) => proxyToPayroll(c, `/api/v1/payroll/employees/${c.req.param('id')}/components`));
app.post('/api/v1/employees/:id/components', (c) => proxyToPayroll(c, `/api/v1/payroll/employees/${c.req.param('id')}/components`));
app.patch('/api/v1/employees/:id/components/:componentId', (c) =>
  proxyToPayroll(c, `/api/v1/payroll/employees/${c.req.param('id')}/components/${c.req.param('componentId')}`)
);
app.delete('/api/v1/employees/:id/components/:componentId', (c) =>
  proxyToPayroll(c, `/api/v1/payroll/employees/${c.req.param('id')}/components/${c.req.param('componentId')}`)
);

app.get('/api/v1/reports/paye-schedule', (c) => proxyToPayroll(c, '/api/v1/payroll/reports/paye-schedule'));
app.get('/api/v1/reports/pension-schedule', (c) => proxyToPayroll(c, '/api/v1/payroll/reports/pension-schedule'));
app.get('/api/v1/reports/payroll-summary', (c) => proxyToPayroll(c, '/api/v1/payroll/reports/payroll-summary'));

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

export default app;

const port = Number(process.env.PORT || 3001);

if (import.meta.url === `file://${process.argv[1]}`) {
  serve({
    fetch: app.fetch,
    port,
  });

  console.warn(`API server running on http://localhost:${port}`);
}
