import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';

// Middleware
import type { Context, MiddlewareHandler } from 'hono';
import { type AuthUser } from '@lumion/types';

// Route handlers
import { createEmployeeRoutes } from './routes/employees.js';
import { createLeaveRoutes } from './routes/leave.js';
import { createAttendanceRoutes } from './routes/attendance.js';
import { createPayrollRoutes } from './routes/payroll.js';
import { createRecruitmentRoutes } from './routes/recruitment.js';
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
  // NOTE: Full auth middleware will be implemented later with NextAuth integration
  // For now, extract from headers for development
  const userId = c.req.header('x-user-id');
  const tenantId = c.req.header('x-tenant-id');

  if (!userId || !tenantId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', userId);
  c.set('tenantId', tenantId);

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
app.route('/api/v1/employees', createEmployeeRoutes());
app.route('/api/v1/leave-requests', createLeaveRoutes());
app.route('/api/v1/attendance', createAttendanceRoutes());
app.route('/api/v1/payroll', createPayrollRoutes());
app.route('/api/v1/recruitment', createRecruitmentRoutes());

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
