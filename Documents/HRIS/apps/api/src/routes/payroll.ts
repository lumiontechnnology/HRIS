import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from './index';

type Env = AppEnv;

const PayrollRunSchema = z.object({
  payScheduleId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

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
          periodStart: new Date(validatedData.periodStart),
          periodEnd: new Date(validatedData.periodEnd),
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

      const run = await prisma.payrollRun.create({
        data: {
          tenantId,
          payScheduleId: validatedData.payScheduleId,
          periodStart: new Date(validatedData.periodStart),
          periodEnd: new Date(validatedData.periodEnd),
          dueDate: new Date(validatedData.dueDate),
          status: 'DRAFT',
          description: validatedData.description,
        },
        include: {
          paySchedule: { select: { name: true, frequency: true } },
        },
      });

      return c.json(
        {
          success: true,
          data: run,
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
            paySchedule: { select: { name: true, frequency: true } },
          },
          orderBy: { periodStart: 'desc' },
          skip,
          take: limit,
        }),
        prisma.payrollRun.count({ where }),
      ]);

      return c.json({
        success: true,
        data: runs,
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

      return c.json({ success: true, data: run });
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
          const basicSalary = emp.salary || 0;

          // Calculate deductions (simplified - 10% tax, 5% insurance)
          const taxDeduction = basicSalary * 0.1;
          const insuranceDeduction = basicSalary * 0.05;
          const totalDeductions = taxDeduction + insuranceDeduction;

          const netSalary = basicSalary - totalDeductions;

          return prisma.payslip.create({
            data: {
              tenantId,
              payrollRunId: id,
              employeeId: emp.id,
              basicSalary,
              earnings: basicSalary,
              taxDeduction,
              insuranceDeduction,
              totalDeductions,
              netSalary,
              status: 'GENERATED',
            },
          });
        })
      );

      // Update payroll run status
      const updatedRun = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'GENERATED',
          totalAmount: payslips.reduce((sum, p) => sum + p.netSalary, 0),
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

      const run = await prisma.payrollRun.findUnique({
        where: { id },
      });

      if (!run || run.tenantId !== tenantId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } },
          404
        );
      }

      const updated = await prisma.payrollRun.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
        include: {
          paySchedule: true,
          payslips: { select: { id: true, status: true } },
        },
      });

      return c.json({
        success: true,
        data: updated,
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
      const status = c.req.query('status');

      const skip = (page - 1) * limit;

      const where: any = { payrollRun: { tenantId } };
      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;

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
                periodStart: true,
                periodEnd: true,
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
        data: payslips,
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
              periodStart: true,
              periodEnd: true,
              dueDate: true,
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

      return c.json({ success: true, data: payslip });
    } catch (error) {
      console.error('Error fetching payslip:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch payslip' } },
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
            periodStart: { gte: currentMonth, lt: nextMonth },
          },
        }),
        prisma.payrollRun.findFirst({
          where: {
            tenantId,
            periodStart: { lt: currentMonth },
          },
          orderBy: { periodStart: 'desc' },
        }),
        prisma.payslip.count({
          where: { payrollRun: { tenantId } },
        }),
      ]);

      const thisMonthTotal = thisMonthRun?.totalAmount || 0;
      const lastMonthTotal = lastMonthRun?.totalAmount || 0;

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
