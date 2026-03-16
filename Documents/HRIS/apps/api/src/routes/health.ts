import { Hono } from 'hono';
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
      // Check database connection
      const prisma = require('@lumion/database').PrismaClient;
      const client = new prisma();
      await client.$queryRaw`SELECT 1`;
      await client.$disconnect();

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
