import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';

type Env = AppEnv;

const NotificationCreateSchema = z.object({
  userId: z.string().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().optional(),
});

export function createNotificationRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.get('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const unreadOnly = c.req.query('unreadOnly') === 'true';
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

      const notifications = await prisma.notification.findMany({
        where: {
          tenantId,
          OR: [{ userId: null }, { userId }],
          ...(unreadOnly ? { read: false } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return c.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch notifications' } }, 500);
    }
  });

  app.post('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = NotificationCreateSchema.parse(body);

      const created = await prisma.notification.create({
        data: {
          tenantId,
          userId: validated.userId,
          type: validated.type,
          title: validated.title,
          message: validated.message,
          actionUrl: validated.actionUrl,
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating notification:', error);
      return c.json({ success: false, error: { message: 'Failed to create notification' } }, 500);
    }
  });

  app.patch('/:id/read', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const id = c.req.param('id');

      const existing = await prisma.notification.findFirst({
        where: {
          id,
          tenantId,
          OR: [{ userId: null }, { userId }],
        },
      });

      if (!existing) {
        return c.json({ success: false, error: { message: 'Notification not found' } }, 404);
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return c.json({ success: false, error: { message: 'Failed to update notification' } }, 500);
    }
  });

  return app;
}
