import { Hono } from 'hono';
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

  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userRecord = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: { roles: true },
  });

  if (!userRecord) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const appUser: AuthUser = {
    id: userRecord.id,
    email: userRecord.email,
    firstName: userRecord.firstName,
    lastName: userRecord.lastName,
    tenantId: userRecord.tenantId,
    roles: userRecord.roles.map((role) => role.name) as AuthUser['roles'],
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
