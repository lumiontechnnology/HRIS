import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../index.js';
import { computeNigeriaMonthlyPayroll } from '../lib/payroll/calc.js';
import { getRolesFromContext, requireAnyRole, type Role } from '../lib/auth/rbac.js';
import {
  notifyPayrollDisbursed,
  notifyPayrollRejected,
  notifyPayrollStepApproved,
  notifyPayrollSubmitted,
} from '../lib/email/payroll-notifications.js';

type Env = AppEnv;

const APPROVAL_FLOW: Array<{ step: number; role: Role; status: string }> = [
  { step: 1, role: 'HR_ADMIN', status: 'PENDING_HR' },
  { step: 2, role: 'HEAD_OF_HR', status: 'PENDING_HEAD_OF_HR' },
  { step: 3, role: 'PAYROLL_AUDITOR', status: 'PENDING_AUDIT' },
  { step: 4, role: 'FINANCE_OFFICER', status: 'PENDING_FINANCE' },
];

const rejectSchema = z.object({
  reason: z.string().trim().min(3, 'Reason is required').max(400),
});

const approveSchema = z.object({
  note: z.string().trim().max(400).optional(),
});

type PayrollApprovalRow = {
  id: string;
  payroll_run_id: string;
  step: number;
  role_required: string;
  action: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by: string | null;
  note: string | null;
  actioned_at: Date | null;
  created_at: Date;
};

async function listApprovals(payrollRunId: string): Promise<PayrollApprovalRow[]> {
  return prisma.$queryRawUnsafe<PayrollApprovalRow[]>(
    `SELECT id, payroll_run_id, step, role_required, action, approved_by, note, actioned_at, created_at
       FROM payroll_approvals
      WHERE payroll_run_id = $1
      ORDER BY step ASC`,
    payrollRunId
  );
}

async function seedApprovals(tenantId: string, payrollRunId: string): Promise<void> {
  const existing = await listApprovals(payrollRunId);
  if (existing.length > 0) return;

  await Promise.all(
    APPROVAL_FLOW.map((item) =>
      prisma.$executeRawUnsafe(
        `INSERT INTO payroll_approvals
          (id, tenant_id, payroll_run_id, step, role_required, action, created_at)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())`,
        randomUUID(),
        tenantId,
        payrollRunId,
        item.step,
        item.role
      )
    )
  );
}

async function currentPendingApproval(payrollRunId: string): Promise<PayrollApprovalRow | null> {
  const rows = await prisma.$queryRawUnsafe<PayrollApprovalRow[]>(
    `SELECT id, payroll_run_id, step, role_required, action, approved_by, note, actioned_at, created_at
       FROM payroll_approvals
      WHERE payroll_run_id = $1 AND action = 'PENDING'
      ORDER BY step ASC
      LIMIT 1`,
    payrollRunId
  );

  return rows[0] || null;
}

const PayrollRunSchema = z.object({
  payScheduleId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

const runStateTransitions: Record<string, string[]> = {
  DRAFT: ['PROCESSING'],
  PENDING_HR: ['PENDING_HEAD_OF_HR', 'REJECTED'],
  PENDING_HEAD_OF_HR: ['PENDING_AUDIT', 'REJECTED'],
  PENDING_AUDIT: ['PENDING_FINANCE', 'REJECTED'],
  PENDING_FINANCE: ['DISBURSED', 'REJECTED'],
  PROCESSING: ['REVIEW'],
  REVIEW: ['APPROVED'],
  APPROVED: ['DISBURSED'],
  DISBURSED: ['LOCKED'],
  REJECTED: [],
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

function formatNaira(value: number): string {
  return `NGN ${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPayslipHtml(payload: {
  employeeName: string;
  employeeEmail: string;
  employeeId: string;
  department?: string;
  jobTitle?: string;
  periodStart: Date;
  periodEnd: Date;
  grossPay: number;
  deductions: number;
  netPay: number;
  taxDeduction: number;
  pensionDeduction: number;
  nhfDeduction: number;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payslip - ${payload.employeeName}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
      .title { font-size: 28px; font-weight: 700; margin: 0; }
      .muted { color: #475569; font-size: 13px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
      .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
      .label { font-size: 12px; text-transform: uppercase; color: #64748b; }
      .value { font-size: 15px; font-weight: 600; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
      th { background: #f8fafc; }
      .total { margin-top: 18px; border: 1px solid #16a34a; border-radius: 8px; padding: 12px; background: #f0fdf4; }
      .net { font-size: 26px; font-weight: 700; color: #166534; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1 class="title">Payroll Payslip</h1>
        <p class="muted">Period: ${payload.periodStart.toLocaleDateString()} - ${payload.periodEnd.toLocaleDateString()}</p>
      </div>
      <div class="muted">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="grid">
      <div class="card"><div class="label">Employee Name</div><div class="value">${payload.employeeName}</div></div>
      <div class="card"><div class="label">Employee ID</div><div class="value">${payload.employeeId}</div></div>
      <div class="card"><div class="label">Department</div><div class="value">${payload.department || '-'}</div></div>
      <div class="card"><div class="label">Position</div><div class="value">${payload.jobTitle || '-'}</div></div>
      <div class="card"><div class="label">Email</div><div class="value">${payload.employeeEmail}</div></div>
      <div class="card"><div class="label">Currency</div><div class="value">NGN</div></div>
    </div>

    <table>
      <thead>
        <tr><th>Component</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>Gross Pay</td><td>${formatNaira(payload.grossPay)}</td></tr>
        <tr><td>PAYE Tax</td><td>-${formatNaira(payload.taxDeduction)}</td></tr>
        <tr><td>Pension</td><td>-${formatNaira(payload.pensionDeduction)}</td></tr>
        <tr><td>NHF</td><td>-${formatNaira(payload.nhfDeduction)}</td></tr>
        <tr><td>Total Deductions</td><td>-${formatNaira(payload.deductions)}</td></tr>
      </tbody>
    </table>

    <div class="total">
      <div class="label">Net Salary</div>
      <div class="net">${formatNaira(payload.netPay)}</div>
    </div>
  </body>
</html>`;
}

export const createPayrollRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  app.post('/runs/:id/submit', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const run = await prisma.payrollRun.findFirst({
        where: { id, tenantId },
        include: { payslips: { select: { grossPay: true } } },
      });

      if (!run) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } }, 404);
      }

      if (!['DRAFT', 'REVIEW', 'GENERATED'].includes(run.status)) {
        return c.json(
          { success: false, error: { code: 'INVALID_STATE', message: `Cannot submit from ${run.status}` } },
          400
        );
      }

      await prisma.payrollRun.update({
        where: { id },
        data: { status: 'PENDING_HR' },
      });

      await seedApprovals(tenantId, run.id);

      const hrAdmins = await prisma.user.findMany({
        where: { tenantId, roles: { some: { name: 'HR_ADMIN' } } },
        select: { email: true },
      });

      await notifyPayrollSubmitted({
        to: hrAdmins.map((user) => user.email).filter(Boolean),
        period: run.period,
        runId: run.id,
        totalEmployees: run.payslips.length,
        totalGross: run.payslips.reduce((sum, payslip) => sum + Number(payslip.grossPay), 0),
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: c.get('userId'),
          action: 'UPDATE',
          resource: 'payroll_run',
          resourceId: run.id,
          changes: {
            transition: 'submit',
            status: 'PENDING_HR',
          },
        },
      });

      return c.json({ success: true, message: 'Payroll run submitted for approval' });
    } catch (error) {
      console.error('Error submitting payroll run:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to submit payroll run' } }, 500);
    }
  });

  app.post('/runs/:id/approve', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const payload = approveSchema.parse(await c.req.json().catch(() => ({})));

      const run = await prisma.payrollRun.findFirst({
        where: { id, tenantId },
        include: {
          payslips: {
            include: {
              employee: { select: { email: true } },
            },
          },
        },
      });

      if (!run) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } }, 404);
      }

      const flowItem = APPROVAL_FLOW.find((item) => item.status === run.status);
      if (!flowItem) {
        return c.json(
          { success: false, error: { code: 'INVALID_STATE', message: `Run is not awaiting approval (${run.status})` } },
          400
        );
      }

      let pendingStep: PayrollApprovalRow | null = null;
      try {
        pendingStep = await currentPendingApproval(run.id);
      } catch {
        pendingStep = null;
      }

      const requiredRole = pendingStep?.role_required || flowItem.role;

      const userRoles = getRolesFromContext(c);
      if (!userRoles.includes(requiredRole as Role) && !userRoles.includes('SUPER_ADMIN')) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot approve this step' } }, 403);
      }

      const currentIndex = APPROVAL_FLOW.findIndex((item) => item.status === run.status);
      const next = APPROVAL_FLOW[currentIndex + 1];

      const nextStatus = next ? next.status : 'DISBURSED';

      await prisma.payrollRun.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      if (pendingStep) {
        await prisma.$executeRawUnsafe(
          `UPDATE payroll_approvals
              SET action = 'APPROVED', approved_by = $1, note = $2, actioned_at = NOW()
            WHERE id = $3`,
          userId,
          payload.note || null,
          pendingStep.id
        );
      }

      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'System';

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'APPROVE',
          resource: 'payroll_run',
          resourceId: run.id,
          changes: {
            from: run.status,
            to: nextStatus,
            note: payload.note || null,
            step: flowItem.step,
            roleRequired: requiredRole,
          },
        },
      });

      if (next) {
        const nextApprovers = await prisma.user.findMany({
          where: { tenantId, roles: { some: { name: next.role } } },
          select: { email: true },
        });

        await notifyPayrollStepApproved({
          to: nextApprovers.map((item) => item.email).filter(Boolean),
          period: run.period,
          runId: run.id,
          approvedBy: actorName,
          nextRole: next.role,
        });
      } else {
        await Promise.all(
          run.payslips.map(async (payslip) => {
            if (!payslip.employee.email) return;
            await notifyPayrollDisbursed({
              to: [payslip.employee.email],
              period: run.period,
              netPay: Number(payslip.netPay),
              payslipUrl: payslip.pdfUrl || `/api/v1/payroll/payslips/${payslip.id}/pdf`,
            });
          })
        );

        await prisma.payslip.updateMany({
          where: { payrollRunId: run.id, sentAt: null },
          data: { sentAt: new Date() },
        });
      }

      return c.json({
        success: true,
        data: {
          id: run.id,
          status: nextStatus,
        },
        message: next ? 'Payroll step approved' : 'Payroll approved and disbursed',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid approval payload',
              details: error.errors.map((item) => ({ field: item.path.join('.'), message: item.message })),
            },
          },
          400
        );
      }

      console.error('Error approving payroll step:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to approve payroll run' } }, 500);
    }
  });

  app.post('/runs/:id/reject', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const payload = rejectSchema.parse(await c.req.json());

      const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
      if (!run) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } }, 404);
      }

      const flowItem = APPROVAL_FLOW.find((item) => item.status === run.status);
      if (!flowItem) {
        return c.json(
          { success: false, error: { code: 'INVALID_STATE', message: `Cannot reject from ${run.status}` } },
          400
        );
      }

      let pendingStep: PayrollApprovalRow | null = null;
      try {
        pendingStep = await currentPendingApproval(run.id);
      } catch {
        pendingStep = null;
      }

      const requiredRole = pendingStep?.role_required || flowItem.role;

      const roles = getRolesFromContext(c);
      if (!roles.includes(requiredRole as Role) && !roles.includes('SUPER_ADMIN')) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot reject this step' } }, 403);
      }

      await prisma.payrollRun.update({
        where: { id: run.id },
        data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: payload.reason },
      });

      if (pendingStep) {
        await prisma.$executeRawUnsafe(
          `UPDATE payroll_approvals
              SET action = 'REJECTED', approved_by = $1, note = $2, actioned_at = NOW()
            WHERE id = $3`,
          userId,
          payload.reason,
          pendingStep.id
        );
      }

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'REJECT',
          resource: 'payroll_run',
          resourceId: run.id,
          changes: {
            from: run.status,
            to: 'REJECTED',
            reason: payload.reason,
            roleRequired: requiredRole,
          },
        },
      });

      const hrUsers = await prisma.user.findMany({
        where: { tenantId, roles: { some: { name: 'HR_ADMIN' } } },
        select: { email: true },
      });

      const actor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : 'System';

      await notifyPayrollRejected({
        to: hrUsers.map((item) => item.email).filter(Boolean),
        period: run.period,
        runId: run.id,
        rejectedBy: actorName,
        reason: payload.reason,
      });

      return c.json({ success: true, message: 'Payroll run rejected and locked for this cycle' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid rejection payload',
              details: error.errors.map((item) => ({ field: item.path.join('.'), message: item.message })),
            },
          },
          400
        );
      }

      console.error('Error rejecting payroll run:', error);
      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to reject payroll run' } }, 500);
    }
  });

  app.get('/runs/:id/approvals', async (c) => {
    const id = c.req.param('id');
    const tenantId = c.get('tenantId');

    const run = await prisma.payrollRun.findFirst({
      where: { id, tenantId },
      include: {
        paySchedule: { select: { name: true } },
      },
    });

    if (!run) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payroll run not found' } }, 404);
    }

    let steps: Array<{
      step: number;
      role: string;
      status: string;
      approver: string | null;
      at: Date | null;
    }> = [];

    const dbApprovals = await listApprovals(run.id);
    const approverIds = Array.from(new Set(dbApprovals.map((item) => item.approved_by).filter(Boolean))) as string[];
    const approvers = approverIds.length
      ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const approverMap = new Map(approvers.map((item) => [item.id, `${item.firstName} ${item.lastName}`.trim()]));

    steps = APPROVAL_FLOW.map((flowStep) => {
      const row = dbApprovals.find((item) => item.step === flowStep.step);
      const mappedStatus = row?.action ?? (run.status === flowStep.status ? 'PENDING' : 'PENDING');
      return {
        step: flowStep.step,
        role: flowStep.role,
        status: mappedStatus,
        approver: row?.approved_by ? approverMap.get(row.approved_by) ?? null : null,
        at: row?.actioned_at ?? null,
      };
    });

    return c.json({
      success: true,
      data: {
        run: {
          id: run.id,
          period: run.period,
          status: run.status,
          name: run.paySchedule.name,
        },
        steps,
      },
    });
  });

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
   * Generate and persist payslip document URL for storage retrieval
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

      const pdfUrl = `/api/v1/payroll/payslips/${payslip.id}/pdf`;
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
   * GET /api/v1/payroll/payslips/:id/pdf
   * Render a printable payslip document
   */
  app.get('/payslips/:id/pdf', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.get('tenantId');

      const payslip = await prisma.payslip.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
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
              tenantId: true,
              startDate: true,
              endDate: true,
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

      const details = Array.isArray(payslip.deductionDetails) ? payslip.deductionDetails : [];
      const amountFor = (component: string): number => {
        const entry = (details as Array<{ component?: unknown; amount?: unknown }>).find(
          (row) => String(row.component || '').toUpperCase() === component.toUpperCase()
        );

        return Number(entry?.amount || 0);
      };

      const html = buildPayslipHtml({
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`.trim(),
        employeeEmail: payslip.employee.email,
        employeeId: payslip.employee.employeeId,
        department: payslip.employee.department?.name,
        jobTitle: payslip.employee.jobTitle?.title,
        periodStart: payslip.payrollRun.startDate,
        periodEnd: payslip.payrollRun.endDate,
        grossPay: Number(payslip.grossPay),
        deductions: Number(payslip.deductions),
        netPay: Number(payslip.netPay),
        taxDeduction: amountFor('PAYE TAX'),
        pensionDeduction: amountFor('PENSION'),
        nhfDeduction: amountFor('NHF'),
      });

      return c.html(html);
    } catch (error) {
      console.error('Error rendering payslip document:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to render payslip document' } },
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
          pdfUrl: payslip.pdfUrl || `/api/v1/payroll/payslips/${payslip.id}/pdf`,
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
