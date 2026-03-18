import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';

type Env = AppEnv;

const monthLabel = (date: Date): string => {
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear().toString().slice(-2);
  return `${month} '${year}`;
};

async function getHeadcountAtMonthEnd(tenantId: string, date: Date): Promise<number> {
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

  return prisma.employee.count({
    where: {
      tenantId,
      hireDate: { lte: monthEnd },
      OR: [{ terminationDate: null }, { terminationDate: { gt: monthEnd } }],
    },
  });
}

export function createDashboardRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.get('/summary', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const now = new Date();

      const months = Array.from({ length: 12 }).map((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
        return date;
      });

      const [
        totalEmployees,
        activeEmployees,
        terminatedInYear,
        departmentCounts,
        pendingLeaveRequests,
        pendingPayrollRuns,
        latestNotifications,
        activity,
        latestPayrollRun,
        headcountTrend,
      ] = await Promise.all([
        prisma.employee.count({ where: { tenantId } }),
        prisma.employee.count({ where: { tenantId, employmentStatus: 'ACTIVE' } }),
        prisma.employee.count({
          where: {
            tenantId,
            terminationDate: {
              gte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
            },
          },
        }),
        prisma.employee.groupBy({
          by: ['departmentId'],
          where: { tenantId, employmentStatus: 'ACTIVE' },
          _count: { departmentId: true },
          orderBy: { _count: { departmentId: 'desc' } },
          take: 8,
        }),
        prisma.leaveRequest.findMany({
          where: { tenantId, status: 'SUBMITTED' },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.payrollRun.findMany({
          where: { tenantId, status: 'REVIEW' },
          orderBy: { updatedAt: 'desc' },
          take: 8,
          include: {
            paySchedule: {
              select: { name: true },
            },
          },
        }),
        prisma.notification.findMany({
          where: {
            tenantId,
            OR: [{ userId: null }, { userId }],
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.auditLog.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        }),
        prisma.payrollRun.findFirst({
          where: { tenantId },
          orderBy: { startDate: 'desc' },
          include: {
            payslips: {
              select: { netPay: true },
            },
          },
        }),
        Promise.all(months.map((month) => getHeadcountAtMonthEnd(tenantId, month))),
      ]);

      const departments = await prisma.department.findMany({
        where: {
          tenantId,
          id: { in: departmentCounts.map((item) => item.departmentId) },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const departmentNameMap = new Map(departments.map((item) => [item.id, item.name]));

      const monthlyPayrollCost = Number(
        (latestPayrollRun?.payslips || []).reduce((sum, slip) => sum + Number(slip.netPay), 0)
      );

      const pendingApprovals = [
        ...pendingLeaveRequests.map((item) => ({
          id: item.id,
          type: 'Leave Request',
          owner: `${item.employee.firstName} ${item.employee.lastName}`.trim() || 'Employee',
          age: `${Math.max(1, Math.round((now.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60)))}h`,
        })),
        ...pendingPayrollRuns.map((item) => ({
          id: item.id,
          type: 'Payroll Review',
          owner: item.paySchedule.name,
          age: `${Math.max(1, Math.round((now.getTime() - item.updatedAt.getTime()) / (1000 * 60 * 60)))}h`,
        })),
      ]
        .sort((left, right) => (left.age > right.age ? 1 : -1))
        .slice(0, 8);

      return c.json({
        success: true,
        data: {
          kpis: {
            totalEmployees,
            activeEmployees,
            monthlyPayrollCost,
            attritionRate:
              totalEmployees > 0
                ? Number(((terminatedInYear / totalEmployees) * 100).toFixed(1))
                : 0,
          },
          headcountTrend: months.map((month, index) => ({
            label: monthLabel(month),
            value: headcountTrend[index],
          })),
          departmentDistribution: departmentCounts.map((item) => ({
            name: departmentNameMap.get(item.departmentId) || 'Unassigned',
            count: item._count.departmentId,
          })),
          pendingApprovals,
          notifications: latestNotifications.map((item) => ({
            id: item.id,
            message: item.message,
            title: item.title,
            type: item.type,
            read: item.read,
            createdAt: item.createdAt,
          })),
          activityLog: activity.map((item) => ({
            id: item.id,
            actor:
              `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() ||
              item.userId ||
              'System',
            action: `${item.action} ${item.resource}`,
            time: item.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch dashboard summary' } }, 500);
    }
  });

  return app;
}
