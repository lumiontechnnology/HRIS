import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';

export function createHealthRoutes(): Hono<AppEnv> {
  const app = new Hono();

  // Basic health check
  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Readiness check (app is ready to accept traffic)
  app.get('/ready', async (c) => {
    try {
      // Check database connection through the shared Prisma client
      await prisma.$queryRawUnsafe('SELECT 1');

      return c.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          api: 'ok',
        },
      });
    } catch (error) {
      return c.json(
        {
          status: 'not_ready',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        503
      );
    }
  });

  // Liveness check (app is alive)
  app.get('/live', (c) => {
    return c.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return app;
}
