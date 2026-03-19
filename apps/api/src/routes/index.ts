import { Hono } from 'hono';
import { createEmployeeRoutes } from './employees';
import { createLeaveRoutes } from './leave';

export const createRoutes = (): Hono => {
  const app = new Hono();

  app.route('/employees', createEmployeeRoutes());
  app.route('/leave-requests', createLeaveRoutes());

  return app;
};
