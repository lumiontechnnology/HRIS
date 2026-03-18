import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';
import { computeNigeriaMonthlyPayroll } from '../lib/payroll/calc.js';

type Env = AppEnv;

const PayrollRunSchema = z.object({
  payScheduleId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

const runStateTransitions: Record<string, string[]> = {
  DRAFT: ['PROCESSING'],
  PROCESSING: ['REVIEW'],
  REVIEW: ['APPROVED'],
  APPROVED: ['DISBURSED'],
  DISBURSED: ['LOCKED'],
  LOCKED: [],
};

function canTransition(current: string, next: string): boolean {
  return (runStateTransitions[current] || []).includes(next);
}

function mapRunStatusForLegacyUi(status: string): string {
  if (status === 'REVIEW') return 'GENERATED';
  if (status === 'DISBURSED') return 'PAID';
  return status;
}

function mapRunForResponse(run: {
  id: string;
  period: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  payslips?: Array<{ netPay: unknown }>;
  paySchedule: { id?: string; name: string; frequency: string };
}) {
  const totalAmount = (run.payslips || []).reduce((sum, slip) => sum + Number(slip.netPay), 0);

  return {
    ...run,
    periodStart: run.startDate,
    periodEnd: run.endDate,
    dueDate: run.endDate,
    status: mapRunStatusForLegacyUi(run.status),
    workflowStatus: run.status,
    totalAmount,
  };
}

function mapPayslipForResponse(payslip: {
  id: string;
  grossPay: unknown;
  deductions: unknown;
  netPay: unknown;
  deductionDetails: unknown;
  payrollRun: { startDate: Date; endDate: Date; status: string };
}) {
  const details = Array.isArray(payslip.deductionDetails) ? payslip.deductionDetails : [];
  const findAmount = (component: string): number => {
    const row = details.find(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'component' in item &&
        String((item as { component: string }).component).toUpperCase() === component.toUpperCase()
    ) as { amount?: unknown } | undefined;

    return Number(row?.amount || 0);
  };

  return {
    ...payslip,
    basicSalary: Number(payslip.grossPay),
    taxDeduction: findAmount('PAYE Tax'),
    insuranceDeduction: findAmount('Pension') + findAmount('NHF'),
    totalDeductions: Number(payslip.deductions),
    netSalary: Number(payslip.netPay),
    payrollRun: {
      ...payslip.payrollRun,
      periodStart: payslip.payrollRun.startDate,
      periodEnd: payslip.payrollRun.endDate,
      dueDate: payslip.payrollRun.endDate,
      status: mapRunStatusForLegacyUi(payslip.payrollRun.status),
      workflowStatus: payslip.payrollRun.status,
    },
  };
}

function payslipStorageUrl(tenantId: string, payrollRunId: string, payslipId: string): string {
  const storageBase =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.APP_URL || '';

  if (!storageBase) {
    return `/storage/payslips/${tenantId}/${payrollRunId}/${payslipId}.pdf`;
  }

  return `${storageBase.replace(/\/$/, '')}/storage/v1/object/public/payslips/${tenantId}/${payrollRunId}/${payslipId}.pdf`;
}

export const createPayrollRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  /**
   * POST /api/v1/payroll/runs
   * Create new payroll run
   */
  app.post('/runs', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validatedData = PayrollRunSchema.parse(body);

      // Check if payroll run already exists for this period
      const existing = await prisma.payrollRun.findFirst({
        where: {
          tenantId,
          payScheduleId: validatedData.payScheduleId,
          startDate: new Date(validatedData.periodStart),
          endDate: new Date(validatedData.periodEnd),
        },
      });

      if (existing) {
        return c.json(
          {
            success: false,
            error: { code: 'DUPLICATE_RUN', message: 'Payroll run already exists for this period' },
          },
          400
        );
      }

      const period = validatedData.periodStart.slice(0, 7);

      const run = await prisma.payrollRun.create({
        data: {
          tenantId,
          payScheduleId: validatedData.payScheduleId,
          period,
          startDate: new Date(validatedData.periodStart),
          endDate: new Date(validatedData.periodEnd),
          status: 'DRAFT',
        },
        include: {
          paySchedule: { select: { id: true, name: true, frequency: true } },
          payslips: { select: { netPay: true } },
        },
      });

      return c.json(
        {
          success: true,
          data: mapRunForResponse(run),
          message: 'Payroll run created successfully',
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
      console.error('Error creating payroll run:', error);
      return c.json(
        { success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create payroll run' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/payroll/runs
   * List payroll runs with pagination
   */
  app.get('/runs', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const status = c.req.query('status');

      const skip = (page - 1) * limit;

      const where: any = { tenantId };
      if (status) where.status = status;

      const [runs, total] = await Promise.all([
        prisma.payrollRun.findMany({
          where,
          include: {
            paySchedule: { select: { id: true, name: true, frequency: true } },
            payslips: { select: { netPay: true } },
          },
          orderBy: { startDate: 'desc' },
          skip,
          take: limit,
        }),
        prisma.payrollRun.count({ where }),
      ]);

      return c.json({
        success: true,
        data: runs.map(mapRunForResponse),
        meta: {
          page,
          limit,
          total,
          hasMore: skip + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching payroll runs:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch payroll runs' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/payroll/runs/:id
   * Get specific payroll run with payslips
   */
  app.get('/runs/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const run = await prisma.payrollRun.findUnique({
        where: { id },
        include: {
          paySchedule: true,
          payslips: {
            include: {
              employee: { select: { firstName: true, lastName: true, employeeId: true } },
            },
          },
        },
      });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      const mappedRun = {
        ...mapRunForResponse(run),
        payslips: run.payslips.map((slip) => {
          const details = Array.isArray(slip.deductionDetails) ? slip.deductionDetails : [];
          const taxDeduction = Number(
            (details as Array<{ component?: unknown; amount?: unknown }>).find(
              (d) => String(d.component || '').toUpperCase() === 'PAYE TAX'
            )?.amount || 0
          );
          const pension = Number(
            (details as Array<{ component?: unknown; amount?: unknown }>).find(
              (d) => String(d.component || '').toUpperCase() === 'PENSION'
            )?.amount || 0
          );
          const nhf = Number(
            (details as Array<{ component?: unknown; amount?: unknown }>).find(
              (d) => String(d.component || '').toUpperCase() === 'NHF'
            )?.amount || 0
          );

          return {
            ...slip,
            basicSalary: Number(slip.grossPay),
            earnings: Number(slip.grossPay),
            taxDeduction,
            insuranceDeduction: pension + nhf,
            totalDeductions: Number(slip.deductions),
            netSalary: Number(slip.netPay),
            status: run.status,
          };
        }),
      };

      return c.json({ success: true, data: mappedRun });
    } catch (error) {
      console.error('Error fetching payroll run:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch payroll run' } },
        500
      );
    }
  });

  /**
   * POST /api/v1/payroll/runs/:id/generate-payslips
   * Generate payslips for all employees in payroll run
   */
  app.post('/runs/:id/generate-payslips', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const run = await prisma.payrollRun.findUnique({
        where: { id },
      });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      if (run.status !== 'DRAFT') {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_STATE', message: 'Payroll run is not in draft status' },
          },
          400
        );
      }

      if (!canTransition(run.status, 'PROCESSING')) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_TRANSITION', message: `Cannot move from ${run.status} to PROCESSING` },
          },
          400
        );
      }

      await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'PROCESSING',
          processedBy: userId,
          processedAt: new Date(),
        },
      });

      // Get all active employees
      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: 'ACTIVE',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          salary: true,
        },
      });

      // Generate payslips
      const payslips = await Promise.all(
        employees.map(async (emp) => {
          const grossPay = Number(emp.salary || 0);
          const computed = computeNigeriaMonthlyPayroll(grossPay);

          return prisma.payslip.upsert({
            where: {
              employeeId_payrollRunId: {
                employeeId: emp.id,
                payrollRunId: id,
              },
            },
            update: {
              grossPay: computed.grossPay,
              deductions: computed.totalDeductions,
              netPay: computed.netPay,
              earnings: [{ component: 'Basic Salary', amount: computed.grossPay }],
              deductionDetails: [
                { component: 'PAYE Tax', amount: computed.payeTax },
                { component: 'Pension', amount: computed.pension },
                { component: 'NHF', amount: computed.nhf },
              ],
              pdfUrl: payslipStorageUrl(tenantId, id, `employee-${emp.id}`),
            },
            create: {
              tenantId,
              payrollRunId: id,
              employeeId: emp.id,
              grossPay: computed.grossPay,
              deductions: computed.totalDeductions,
              netPay: computed.netPay,
              earnings: [{ component: 'Basic Salary', amount: computed.grossPay }],
              deductionDetails: [
                { component: 'PAYE Tax', amount: computed.payeTax },
                { component: 'Pension', amount: computed.pension },
                { component: 'NHF', amount: computed.nhf },
              ],
              pdfUrl: payslipStorageUrl(tenantId, id, `employee-${emp.id}`),
            },
          });
        })
      );

      if (!canTransition('PROCESSING', 'REVIEW')) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: 'Cannot move from PROCESSING to REVIEW',
            },
          },
          400
        );
      }

      // Update payroll run status
      const updatedRun = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'REVIEW',
        },
      });

      return c.json({
        success: true,
        data: updatedRun,
        message: `Generated ${payslips.length} payslips`,
      });
    } catch (error) {
      console.error('Error generating payslips:', error);
      return c.json(
        { success: false, error: { code: 'GENERATE_ERROR', message: 'Failed to generate payslips' } },
        500
      );
    }
  });

  /**
   * PATCH /api/v1/payroll/runs/:id/approve
   * Approve payroll run (HR only)
   */
  app.patch('/runs/:id/approve', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const run = await prisma.payrollRun.findUnique({
        where: { id },
      });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      if (!canTransition(run.status, 'APPROVED')) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_TRANSITION', message: `Cannot move from ${run.status} to APPROVED` },
          },
          400
        );
      }

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          paySchedule: true,
          payslips: { select: { id: true } },
        },
      });

      return c.json({
        success: true,
        data: mapRunForResponse({ ...updated, period: run.period, startDate: run.startDate, endDate: run.endDate, createdAt: run.createdAt, approvedAt: updated.approvedAt, paySchedule: { id: updated.paySchedule.id, name: updated.paySchedule.name, frequency: updated.paySchedule.frequency }, payslips: [] }),
        message: 'Payroll run approved successfully',
      });
    } catch (error) {
      console.error('Error approving payroll run:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to approve payroll run' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/payroll/payslips
   * List all payslips with filters
   */
  app.get('/payslips', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const employeeId = c.req.query('employeeId');

      const skip = (page - 1) * limit;

      const where: any = { payrollRun: { tenantId } };
      if (employeeId) where.employeeId = employeeId;

      const [payslips, total] = await Promise.all([
        prisma.payslip.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
              },
            },
            payrollRun: {
              select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.payslip.count({ where }),
      ]);

      return c.json({
        success: true,
        data: payslips.map((payslip) => mapPayslipForResponse(payslip as never)),
        meta: {
          page,
          limit,
          total,
          hasMore: skip + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching payslips:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch payslips' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/payroll/payslips/:id
   * Get specific payslip details
   */
  app.get('/payslips/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const payslip = await prisma.payslip.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
            },
          },
          payrollRun: {
            select: {
              id: true,
              tenantId: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      });

      if (!payslip || payslip.payrollRun.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payslip not found' } },
          404
        );
      }

      return c.json({ success: true, data: mapPayslipForResponse(payslip as never) });
    } catch (error) {
      console.error('Error fetching payslip:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch payslip' } },
        500
      );
    }
  });

  /**
   * PATCH /api/v1/payroll/runs/:id/disburse
   * Mark approved payroll run as disbursed
   */
  app.patch('/runs/:id/disburse', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const run = await prisma.payrollRun.findUnique({ where: { id } });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      if (!canTransition(run.status, 'DISBURSED')) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_TRANSITION', message: `Cannot move from ${run.status} to DISBURSED` },
          },
          400
        );
      }

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: { status: 'DISBURSED' },
      });

      await prisma.payslip.updateMany({
        where: { payrollRunId: id, sentAt: null },
        data: { sentAt: new Date() },
      });

      return c.json({
        success: true,
        data: {
          ...updated,
          status: mapRunStatusForLegacyUi(updated.status),
          workflowStatus: updated.status,
        },
        message: 'Payroll disbursed successfully',
      });
    } catch (error) {
      console.error('Error disbursing payroll run:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to disburse payroll run' } },
        500
      );
    }
  });

  /**
   * PATCH /api/v1/payroll/runs/:id/lock
   * Lock disbursed payroll run
   */
  app.patch('/runs/:id/lock', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const run = await prisma.payrollRun.findUnique({ where: { id } });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      if (!canTransition(run.status, 'LOCKED')) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_TRANSITION', message: `Cannot move from ${run.status} to LOCKED` },
          },
          400
        );
      }

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: { status: 'LOCKED' },
      });

      return c.json({
        success: true,
        data: {
          ...updated,
          status: mapRunStatusForLegacyUi(updated.status),
          workflowStatus: updated.status,
        },
        message: 'Payroll run locked successfully',
      });
    } catch (error) {
      console.error('Error locking payroll run:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to lock payroll run' } },
        500
      );
    }
  });

  /**
   * POST /api/v1/payroll/payslips/:id/generate-pdf
   * Generate and persist payslip PDF URL placeholder for storage retrieval
   */
  app.post('/payslips/:id/generate-pdf', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const payslip = await prisma.payslip.findUnique({ where: { id } });

      if (!payslip || payslip.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payslip not found' } },
          404
        );
      }

      const pdfUrl = payslipStorageUrl(tenantId, payslip.payrollRunId, payslip.id);
      const updated = await prisma.payslip.update({
        where: { id },
        data: { pdfUrl },
      });

      return c.json({
        success: true,
        data: {
          id: updated.id,
          pdfUrl: updated.pdfUrl,
        },
      });
    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to generate payslip PDF' } },
        500
      );
    }
  });

  /**
   * POST /api/v1/payroll/payslips/:id/send
   * Mark payslip as delivered
   */
  app.post('/payslips/:id/send', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const payslip = await prisma.payslip.findUnique({ where: { id } });
      if (!payslip || payslip.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payslip not found' } },
          404
        );
      }

      const updated = await prisma.payslip.update({
        where: { id },
        data: {
          sentAt: new Date(),
        },
      });

      return c.json({
        success: true,
        data: {
          id: updated.id,
          sentAt: updated.sentAt,
        },
      });
    } catch (error) {
      console.error('Error sending payslip:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to send payslip' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/payroll/summary
   * Get payroll summary for dashboard
   */
  app.get('/summary', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      const currentMonth = new Date();
      currentMonth.setDate(1); // Start of month
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const [totalEmployees, thisMonthRun, lastMonthRun, totalPayslips] = await Promise.all([
        prisma.employee.count({
          where: { tenantId, employmentStatus: 'ACTIVE' },
        }),
        prisma.payrollRun.findFirst({
          where: {
            tenantId,
            startDate: { gte: currentMonth, lt: nextMonth },
          },
        }),
        prisma.payrollRun.findFirst({
          where: {
            tenantId,
            startDate: { lt: currentMonth },
          },
          orderBy: { startDate: 'desc' },
        }),
        prisma.payslip.count({
          where: { payrollRun: { tenantId } },
        }),
      ]);

      const [thisMonthPayslips, lastMonthPayslips] = await Promise.all([
        thisMonthRun
          ? prisma.payslip.findMany({
              where: { payrollRunId: thisMonthRun.id },
              select: { netPay: true },
            })
          : Promise.resolve([]),
        lastMonthRun
          ? prisma.payslip.findMany({
              where: { payrollRunId: lastMonthRun.id },
              select: { netPay: true },
            })
          : Promise.resolve([]),
      ]);

      const thisMonthTotal = thisMonthPayslips.reduce((sum, p) => sum + Number(p.netPay), 0);
      const lastMonthTotal = lastMonthPayslips.reduce((sum, p) => sum + Number(p.netPay), 0);

      return c.json({
        success: true,
        data: {
          totalEmployees,
          thisMonthPayroll: thisMonthTotal,
          lastMonthPayroll: lastMonthTotal,
          totalPayslips,
          currentRunStatus: thisMonthRun?.status || 'NO_RUN',
        },
      });
    } catch (error) {
      console.error('Error fetching payroll summary:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch summary' } },
        500
      );
    }
  });

  return app;
};
