import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../index.js';

type Env = AppEnv;

const profilePatchSchema = z.object({
  phone: z.string().trim().max(50).optional(),
  personalEmail: z.string().email().optional(),
  addressStreet: z.string().trim().max(120).optional(),
  addressCity: z.string().trim().max(80).optional(),
  addressState: z.string().trim().max(80).optional(),
  addressCountry: z.string().trim().max(80).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(50).optional(),
  emergencyContactRelationship: z.string().trim().max(50).optional(),
  bankName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(40).optional(),
  accountName: z.string().trim().max(120).optional(),
  sortCode: z.string().trim().max(40).optional(),
  name: z.string().trim().max(120).optional(),
  dateOfBirth: z.string().optional(),
  nationalId: z.string().trim().max(80).optional(),
  departmentId: z.string().optional(),
});

const sensitiveFields = new Set(['name', 'dateOfBirth', 'nationalId', 'departmentId']);

export const createMeRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  app.get('/profile', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: true,
        employee: {
          include: {
            department: true,
            manager: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            addresses: true,
            emergencyContacts: true,
          },
        },
      },
    });

    if (!user) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roles[0]?.name || 'EMPLOYEE',
        employee: user.employee ?? null,
      },
    });
  });

  app.get('/dashboard', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: true,
        employee: {
          include: {
            department: true,
            manager: {
              select: { firstName: true, lastName: true, email: true },
            },
            leaveBalances: {
              where: { year: new Date().getFullYear() },
              include: { leaveType: true },
            },
            leaveRequests: true,
            payslips: {
              include: {
                payrollRun: { select: { period: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
          },
        },
      },
    });

    if (!user || !user.employee) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee profile not found' } }, 404);
    }

    const annual = user.employee.leaveBalances.find((item) =>
      item.leaveType.name.toLowerCase().includes('annual')
    );
    const sick = user.employee.leaveBalances.find((item) => item.leaveType.name.toLowerCase().includes('sick'));

    const approved = user.employee.leaveRequests.filter((item) => item.status === 'APPROVED').length;
    const pending = user.employee.leaveRequests.filter((item) =>
      ['SUBMITTED', 'MANAGER_APPROVED', 'HR_APPROVED'].includes(item.status)
    ).length;
    const rejected = user.employee.leaveRequests.filter((item) => item.status === 'REJECTED').length;

    const [tasksTotal, tasksCompleted, announcements] = await Promise.all([
      prisma.trainingEnrollment.count({ where: { tenantId, employeeId: user.employee.id } }),
      prisma.trainingEnrollment.count({ where: { tenantId, employeeId: user.employee.id, status: 'COMPLETED' } }),
      prisma.announcement.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ]);

    return c.json({
      success: true,
      data: {
        profile: {
          name: `${user.firstName} ${user.lastName}`.trim(),
          role: user.roles[0]?.name || 'EMPLOYEE',
          department: user.employee.department?.name || 'Unassigned',
          manager:
            user.employee.manager
              ? `${user.employee.manager.firstName} ${user.employee.manager.lastName}`.trim()
              : null,
          avatar: user.avatar,
          employeeId: user.employee.employeeId,
          hireDate: user.employee.hireDate,
        },
        leaveBalance: {
          annual: annual?.available ?? 0,
          sick: sick?.available ?? 0,
          carried_over: annual?.carried ?? 0,
        },
        recentPayslips: user.employee.payslips.map((p) => ({
          id: p.id,
          period: p.payrollRun.period,
          amount: Number(p.netPay),
          url: p.pdfUrl || `/api/v1/payroll/payslips/${p.id}/pdf`,
        })),
        leaveRequests: { approved, pending, rejected },
        tasks: { total: tasksTotal, completed: tasksCompleted },
        announcements,
      },
    });
  });

  app.get('/payslips', async (c) => {
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { employee: true },
    });

    if (!user?.employee) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } }, 404);
    }

    const payslips = await prisma.payslip.findMany({
      where: { tenantId, employeeId: user.employee.id },
      include: { payrollRun: { select: { period: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      success: true,
      data: payslips.map((item) => ({
        id: item.id,
        period: item.payrollRun.period,
        gross: Number(item.grossPay),
        deductions: Number(item.deductions),
        net: Number(item.netPay),
        pdf_url: item.pdfUrl || `/api/v1/payroll/payslips/${item.id}/pdf`,
      })),
    });
  });

  app.patch('/profile', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const body = profilePatchSchema.parse(await c.req.json());

      const user = await prisma.user.findFirst({ where: { id: userId, tenantId }, include: { employee: true } });
      if (!user?.employee) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, 404);
      }

      const sensitiveChanges = Object.entries(body).filter(([field, value]) => value !== undefined && sensitiveFields.has(field));
      const directChanges = Object.entries(body).filter(([field, value]) => value !== undefined && !sensitiveFields.has(field));

      if (directChanges.length > 0) {
        const direct = Object.fromEntries(directChanges);

        await prisma.employee.update({
          where: { id: user.employee.id },
          data: {
            phone: typeof direct.phone === 'string' ? direct.phone : undefined,
            personalEmail: typeof direct.personalEmail === 'string' ? direct.personalEmail : undefined,
          },
        });

        if (direct.addressStreet || direct.addressCity || direct.addressState || direct.addressCountry) {
          const currentAddress = await prisma.address.findFirst({ where: { employeeId: user.employee.id }, orderBy: { createdAt: 'asc' } });
          const addressPayload = {
            streetAddress: (direct.addressStreet as string | undefined) || currentAddress?.streetAddress || '',
            city: (direct.addressCity as string | undefined) || currentAddress?.city || '',
            state: (direct.addressState as string | undefined) || currentAddress?.state || null,
            country: (direct.addressCountry as string | undefined) || currentAddress?.country || 'Nigeria',
            type: currentAddress?.type || 'RESIDENTIAL',
            isPrimary: true,
          };

          if (currentAddress) {
            await prisma.address.update({ where: { id: currentAddress.id }, data: addressPayload });
          } else if (addressPayload.streetAddress && addressPayload.city) {
            await prisma.address.create({
              data: {
                employeeId: user.employee.id,
                ...addressPayload,
              },
            });
          }
        }

        if (direct.emergencyContactName || direct.emergencyContactPhone || direct.emergencyContactRelationship) {
          const contact = await prisma.emergencyContact.findFirst({ where: { employeeId: user.employee.id }, orderBy: { createdAt: 'asc' } });
          const contactPayload = {
            name: (direct.emergencyContactName as string | undefined) || contact?.name || '',
            phone: (direct.emergencyContactPhone as string | undefined) || contact?.phone || '',
            relationship: (direct.emergencyContactRelationship as string | undefined) || contact?.relationship || 'CONTACT',
            isPrimary: true,
          };

          if (contact) {
            await prisma.emergencyContact.update({ where: { id: contact.id }, data: contactPayload });
          } else if (contactPayload.name && contactPayload.phone) {
            await prisma.emergencyContact.create({ data: { employeeId: user.employee.id, ...contactPayload } });
          }
        }
      }

      // Queue sensitive field changes in the dedicated table — HR must approve before they apply.
      if (sensitiveChanges.length > 0) {
        const fieldPayload = JSON.stringify(Object.fromEntries(sensitiveChanges));
        const requestId = randomUUID();

        await prisma.$executeRawUnsafe(
          `INSERT INTO profile_change_requests
            (id, tenant_id, employee_id, requested_by, fields, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'PENDING', NOW(), NOW())`,
          requestId,
          tenantId,
          user.employee.id,
          userId,
          fieldPayload
        );

        await prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'UPDATE',
            resource: 'profile_change_request',
            resourceId: requestId,
            changes: {
              requestedBy: userId,
              employeeId: user.employee.id,
              fields: Object.fromEntries(sensitiveChanges),
              status: 'PENDING',
            },
          },
        });
      }

      return c.json({
        success: true,
        data: {
          profileUpdated: directChanges.length > 0,
          pendingApprovalFields: sensitiveChanges.map(([field]) => field),
        },
        message:
          sensitiveChanges.length > 0
            ? 'Profile updated and sensitive field changes sent to HR for approval'
            : 'Profile updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid profile update payload',
              details: error.errors.map((item) => ({
                field: item.path.join('.'),
                message: item.message,
              })),
            },
          },
          400
        );
      }

      console.error('Profile update error:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update profile' } }, 500);
    }
  });

  return app;
};
