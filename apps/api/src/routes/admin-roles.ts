import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { Resend } from 'resend';
import type { AppEnv } from '../index.js';
import { requireAnyRole } from '../lib/auth/rbac.js';

type Env = AppEnv;

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
  reason: z.string().trim().max(500).optional(),
});

export const createAdminRoleRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  app.get('/roles', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        roles: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return c.json({
      success: true,
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.roles[0]?.name || 'EMPLOYEE',
        department: user.employee?.department?.name || 'Unassigned',
        assignedAt: user.updatedAt,
      })),
    });
  });

  app.post('/roles', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const assignedBy = c.get('userId');
      const body = assignRoleSchema.parse(await c.req.json());
      const roleName = body.role.trim().toUpperCase();

      const [targetUser, role] = await Promise.all([
        prisma.user.findFirst({ where: { id: body.userId, tenantId } }),
        prisma.role.upsert({
          where: { tenantId_name: { tenantId, name: roleName } },
          update: {},
          create: {
            tenantId,
            name: roleName,
            description: `System role: ${roleName}`,
            isBuiltIn: true,
          },
        }),
      ]);

      if (!targetUser) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
      }

      await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          roles: {
            set: [],
            connect: [{ id: role.id }],
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: assignedBy,
          action: 'UPDATE',
          resource: 'roles',
          resourceId: targetUser.id,
          changes: {
            role: roleName,
            reason: body.reason || null,
          },
        },
      });

      if (process.env.RESEND_API_KEY && targetUser.email) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.SMTP_FROM || 'Lumion HRIS <noreply@lumionhris.com>',
          to: targetUser.email,
          subject: 'Your Lumion HRIS access level has changed',
          text: `Your role has been updated to ${roleName}. If you were not expecting this change, contact HR immediately.`,
        });
      }

      return c.json({
        success: true,
        message: 'Role assigned successfully',
        data: { userId: targetUser.id, role: roleName },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid role assignment payload',
              details: error.errors.map((item) => ({
                field: item.path.join('.'),
                message: item.message,
              })),
            },
          },
          400
        );
      }

      console.error('Role assignment error:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to assign role' } }, 500);
    }
  });

  app.delete('/roles/:userId', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const assignedBy = c.get('userId');
    const userId = c.req.param('userId');

    const employeeRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: 'EMPLOYEE' } },
      update: {},
      create: {
        tenantId,
        name: 'EMPLOYEE',
        description: 'Default employee role',
        isBuiltIn: true,
      },
    });

    const targetUser = await prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!targetUser) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        roles: {
          set: [],
          connect: [{ id: employeeRole.id }],
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: assignedBy,
        action: 'UPDATE',
        resource: 'roles',
        resourceId: targetUser.id,
        changes: {
          role: 'EMPLOYEE',
          reason: 'Role revoked',
        },
      },
    });

    return c.json({ success: true, message: 'Role revoked successfully' });
  });

  return app;
};
