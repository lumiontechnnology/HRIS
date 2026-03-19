import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';
import { hasAnyRole, requireAnyRole } from '../lib/auth/rbac.js';
import { sendLeaveNotification } from '../lib/email/leave-emails.js';

type Env = AppEnv;

const leaveActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().max(300).optional(),
});

export const createManagerRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  app.get('/team', async (c) => {
    const denied = requireAnyRole(c, ['MANAGER', 'SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const managerEmployee = await prisma.employee.findFirst({ where: { tenantId, userId } });
    if (!managerEmployee && hasAnyRole(c, ['MANAGER'])) {
      return c.json({ success: true, data: [] });
    }

    const team = await prisma.employee.findMany({
      where: {
        tenantId,
        ...(managerEmployee ? { managerId: managerEmployee.id } : {}),
        employmentStatus: 'ACTIVE',
      },
      include: {
        jobTitle: { select: { title: true } },
        leaveBalances: { select: { leaveType: { select: { name: true } }, available: true } },
        leaveRequests: {
          where: { createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } },
          select: { id: true, status: true, createdAt: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return c.json({ success: true, data: team });
  });

  app.get('/team/leave-requests', async (c) => {
    const denied = requireAnyRole(c, ['MANAGER', 'SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const managerEmployee = await prisma.employee.findFirst({ where: { tenantId, userId } });

    const requests = await prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'SUBMITTED',
        ...(managerEmployee ? { employee: { managerId: managerEmployee.id } } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
          },
        },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return c.json({ success: true, data: requests });
  });

  app.patch('/leave-requests/:id', async (c) => {
    const denied = requireAnyRole(c, ['MANAGER', 'SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const id = c.req.param('id');
      const body = leaveActionSchema.parse(await c.req.json());

      const managerEmployee = await prisma.employee.findFirst({ where: { tenantId, userId } });
      if (!managerEmployee && hasAnyRole(c, ['MANAGER'])) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Manager profile not linked' } }, 403);
      }

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              managerId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          leaveType: { select: { name: true } },
        },
      });

      if (!leave || leave.tenantId !== tenantId) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } }, 404);
      }

      if (managerEmployee && leave.employee.managerId !== managerEmployee.id) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Out of scope leave request' } }, 403);
      }

      const nextStatus = body.action === 'APPROVE' ? 'MANAGER_APPROVED' : 'REJECTED';
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          approvalNotes: body.reason,
          approvedBy: userId,
          approvalDate: new Date(),
        },
      });

      if (body.action === 'REJECT' && leave.employee.email) {
        await sendLeaveNotification({
          type: 'REJECTED',
          recipientEmail: leave.employee.email,
          employeeName: `${leave.employee.firstName} ${leave.employee.lastName}`.trim(),
          leaveTypeName: leave.leaveType.name,
          startDate: leave.startDate,
          endDate: leave.endDate,
          approverComment: body.reason,
        });
      }

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request payload',
              details: error.errors.map((item) => ({ field: item.path.join('.'), message: item.message })),
            },
          },
          400
        );
      }

      console.error('Manager leave action error:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update leave request' } }, 500);
    }
  });

  app.get('/team/attendance', async (c) => {
    const denied = requireAnyRole(c, ['MANAGER', 'SUPER_ADMIN', 'HR_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const managerEmployee = await prisma.employee.findFirst({ where: { tenantId, userId } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findMany({
      where: {
        tenantId,
        date: { gte: today },
        ...(managerEmployee ? { employee: { managerId: managerEmployee.id } } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, managerId: true } },
      },
      orderBy: { date: 'desc' },
    });

    return c.json({ success: true, data: attendance });
  });

  app.get('/team/payroll', async (c) => {
    const denied = requireAnyRole(c, ['MANAGER', 'SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const managerEmployee = await prisma.employee.findFirst({ where: { tenantId, userId } });

    const members = await prisma.employee.findMany({
      where: {
        tenantId,
        ...(managerEmployee ? { managerId: managerEmployee.id } : {}),
        employmentStatus: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        salary: true,
        currency: true,
      },
    });

    const totalCost = members.reduce((sum, member) => sum + Number(member.salary), 0);

    return c.json({
      success: true,
      data: {
        totalCost,
        currency: members[0]?.currency || 'NGN',
        members,
      },
    });
  });

  return app;
};
