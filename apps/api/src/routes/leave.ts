import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';
import { LeaveRequestCreateSchema } from '@lumion/validators';
import { sendLeaveNotification } from '../lib/email/leave-emails.js';

type Env = AppEnv;

const LeaveRequestApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approverComment: z.string().optional(),
});

export const createLeaveRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  /**
   * GET /api/v1/leave-requests
   * List all leave requests with optional filters
   */
  app.get('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const status = c.req.query('status');
      const employeeId = c.req.query('employeeId');

      const skip = (page - 1) * limit;

      // Build filter
      const where: any = { tenantId };
      if (status) where.status = status;
      if (employeeId) where.employeeId = employeeId;

      // Get current user to check role
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true },
      });

      const isManager = user?.roles.some((r) => r.name === 'MANAGER');
      const isHR = user?.roles.some((r) => r.name === 'HR_ADMIN' || r.name === 'SUPER_ADMIN');

      // Non-managers/HR can only see their own
      if (!isManager && !isHR) {
        const employee = await prisma.employee.findFirst({
          where: { tenantId, userId },
        });
        if (employee) {
          where.employeeId = employee.id;
        }
      }

      const [requests, total] = await Promise.all([
        prisma.leaveRequest.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                jobTitle: { select: { title: true } },
                department: { select: { name: true } },
                manager: { select: { firstName: true, lastName: true } },
              },
            },
            leaveType: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.leaveRequest.count({ where }),
      ]);

      return c.json({
        success: true,
        data: requests,
        meta: {
          page,
          limit,
          total,
          hasMore: skip + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch leave requests' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/leave-requests/:id
   * Get single leave request with full details
   */
  app.get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const request = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
              manager: { select: { firstName: true, lastName: true } },
            },
          },
          leaveType: true,
        },
      });

      if (!request || request.tenantId !== tenantId) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } }, 404);
      }

      return c.json({ success: true, data: request });
    } catch (error) {
      console.error('Error fetching leave request:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch leave request' } },
        500
      );
    }
  });

  /**
   * POST /api/v1/leave-requests
   * Create new leave request
   */
  app.post('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      const body = await c.req.json();
      const validatedData = LeaveRequestCreateSchema.parse(body);

      // Get employee
      const employee = await prisma.employee.findFirst({
        where: { tenantId, id: validatedData.employeeId },
      });

      if (!employee) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
          404
        );
      }

      // Check leave balance
      const balance = await prisma.leaveBalance.findFirst({
        where: {
          employeeId: validatedData.employeeId,
          leaveTypeId: validatedData.leaveTypeId,
          year: new Date().getFullYear(),
        },
      });

      if (!balance || balance.available <= 0) {
        return c.json(
          {
            success: false,
            error: { code: 'INSUFFICIENT_BALANCE', message: 'Insufficient leave balance' },
          },
          400
        );
      }

      // Calculate days
      const startDate = new Date(validatedData.startDate);
      const endDate = new Date(validatedData.endDate);
      const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (daysRequested > balance.available) {
        return c.json(
          {
            success: false,
            error: { code: 'INSUFFICIENT_BALANCE', message: `Only ${balance.available} days available` },
          },
          400
        );
      }

      // Create request
      const request = await prisma.leaveRequest.create({
        data: {
          tenantId,
          employeeId: validatedData.employeeId,
          leaveTypeId: validatedData.leaveTypeId,
          startDate: startDate,
          endDate: endDate,
          duration: daysRequested,
          reason: validatedData.reason,
          status: 'SUBMITTED',
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              manager: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          leaveType: { select: { name: true } },
        },
      });

      if (request.employee.manager?.email) {
        await sendLeaveNotification({
          type: 'SUBMITTED',
          recipientEmail: request.employee.manager.email,
          recipientName:
            `${request.employee.manager.firstName ?? ''} ${request.employee.manager.lastName ?? ''}`.trim() ||
            undefined,
          employeeName: `${request.employee.firstName} ${request.employee.lastName}`.trim(),
          leaveTypeName: request.leaveType.name,
          startDate: request.startDate,
          endDate: request.endDate,
          reason: request.reason,
        });
      }

      return c.json(
        {
          success: true,
          data: request,
          message: 'Leave request submitted successfully',
        },
        201
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          400
        );
      }
      console.error('Error creating leave request:', error);
      return c.json(
        { success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create leave request' } },
        500
      );
    }
  });

  /**
   * PATCH /api/v1/leave-requests/:id/approve
   * Manager or HR approves/rejects leave request
   */
  app.patch('/:id/approve', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const body = await c.req.json();
      const validatedData = LeaveRequestApprovalSchema.parse(body);

      const request = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!request || request.tenantId !== tenantId) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Leave request not found' } }, 404);
      }

      if (request.status !== 'SUBMITTED') {
        return c.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Leave request already processed' } },
          400
        );
      }

      // Update request
      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: validatedData.status,
          approvalDate: new Date(),
          approvedBy: userId,
          approvalNotes: validatedData.approverComment,
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          leaveType: { select: { name: true } },
        },
      });

      // If approved, deduct from balance
      if (validatedData.status === 'APPROVED') {
        await prisma.leaveBalance.update({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year: new Date().getFullYear(),
            },
          },
          data: {
            available: { decrement: request.duration },
            taken: { increment: request.duration },
          },
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: request.employeeId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      if (employee?.email) {
        await sendLeaveNotification({
          type: validatedData.status,
          recipientEmail: employee.email,
          recipientName: `${employee.firstName} ${employee.lastName}`.trim(),
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          leaveTypeName: updated.leaveType.name,
          startDate: request.startDate,
          endDate: request.endDate,
          reason: request.reason,
          approverComment: validatedData.approverComment,
        });
      }

      return c.json({
        success: true,
        data: updated,
        message: `Leave request ${validatedData.status.toLowerCase()} successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          400
        );
      }
      console.error('Error approving leave request:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update leave request' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/leave-requests/employee/:employeeId/balance
   * Get leave balance for employee
   */
  app.get('/employee/:employeeId/balance', async (c) => {
    try {
      const employeeId = c.req.param('employeeId');
      const tenantId = c.get('tenantId');

      const balances = await prisma.leaveBalance.findMany({
        where: {
          employeeId,
          employee: { tenantId },
          year: new Date().getFullYear(),
        },
        include: {
          leaveType: { select: { name: true } },
        },
      });

      return c.json({ success: true, data: balances });
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch leave balance' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/leave-types
   * Get all leave types for tenant
   */
  app.get('/types/list', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      const types = await prisma.leaveType.findMany({
        where: { tenantId },
      });

      return c.json({ success: true, data: types });
    } catch (error) {
      console.error('Error fetching leave types:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch leave types' } },
        500
      );
    }
  });

  return app;
};
