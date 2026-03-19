import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../index.js';
import { getAttendanceSummary } from '../lib/payroll/attendance-feed.js';
import { calculateProratedPayroll } from '../lib/payroll/proration.js';
import { calculateEmployeePayroll } from '../lib/payroll/calculator.js';
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

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Date must be YYYY-MM-DD');

const payrollComponentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(40).regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be UPPER_SNAKE_CASE'),
  type: z.enum(['BASIC', 'ALLOWANCE', 'BONUS', 'EXTRA_PAY', 'OVERTIME', 'DEDUCTION', 'STATUTORY']),
  frequency: z.enum(['FIXED', 'VARIABLE', 'PERCENTAGE', 'FORMULA']).default('FIXED'),
  is_taxable: z.boolean().default(false),
  is_pensionable: z.boolean().default(false),
  is_nhf_applicable: z.boolean().default(false),
  percentage_base: z.enum(['BASIC', 'GROSS']).optional().nullable(),
  percentage_value: z.number().min(0).max(100).optional().nullable(),
  display_on_payslip: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
  description: z.string().max(500).optional().nullable(),
});

const payrollComponentPatchSchema = payrollComponentSchema.partial();

const employeeComponentSchema = z.object({
  componentId: z.string().min(1),
  amount: z.number().min(0).optional(),
  effectiveFrom: isoDateSchema,
});

const employeeComponentPatchSchema = z.object({
  amount: z.number().min(0).optional(),
  effectiveFrom: isoDateSchema.optional(),
  effectiveTo: isoDateSchema.optional().nullable(),
});

const bulkAssignSchema = z.object({
  amount: z.number().min(0),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  effectiveFrom: isoDateSchema,
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

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

function buildReportHtml(title: string, headers: string[], rows: Array<Array<string | number>>): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .muted { color: #475569; font-size: 12px; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f8fafc; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p class="muted">Generated on ${new Date().toLocaleString('en-NG')}</p>
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </body>
</html>`;
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
  earningsLines?: Array<{ component: string; amount: number; taxable?: boolean }>;
  taxableIncome?: number;
  pensionBase?: number;
  employerPension?: number;
  daysWorked?: number;
  totalWorkingDays?: number;
  overtimeHours?: number;
  daysAbsent?: number;
  finalSettlement?: {
    proratedSalary?: number;
    unusedLeavePayout?: number;
    gratuity?: number;
    grossSettlement?: number;
    taxOnSettlement?: number;
    loanDeduction?: number;
    netSettlement?: number;
  } | null;
}): string {
  const isFinalSettlement = !!payload.finalSettlement;
  if (isFinalSettlement) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Final Settlement - ${payload.employeeName}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { font-size: 24px; margin: 0 0 6px; }
      .muted { color: #475569; font-size: 13px; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
      th { background: #f8fafc; }
      .section-title { margin-top: 20px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
      .net { margin-top: 18px; border: 1px solid #166534; background: #f0fdf4; border-radius: 8px; padding: 12px; }
      .net p { margin: 0; }
      .net .amount { font-size: 24px; font-weight: 700; color: #166534; }
    </style>
  </head>
  <body>
    <h1>Final Settlement Statement</h1>
    <p class="muted">Employee: ${payload.employeeName} · ${payload.employeeId}</p>
    <p class="muted">Last Payroll Period: ${payload.periodStart.toLocaleDateString()} - ${payload.periodEnd.toLocaleDateString()}</p>

    <p class="section-title">Earnings</p>
    <table>
      <tbody>
        <tr><td>Prorated Basic</td><td>${formatNaira(payload.finalSettlement?.proratedSalary || 0)}</td></tr>
        <tr><td>Unused Annual Leave Payout</td><td>${formatNaira(payload.finalSettlement?.unusedLeavePayout || 0)}</td></tr>
        <tr><td>Gratuity</td><td>${formatNaira(payload.finalSettlement?.gratuity || 0)}</td></tr>
        <tr><td>Gross Settlement</td><td>${formatNaira(payload.finalSettlement?.grossSettlement || payload.grossPay)}</td></tr>
      </tbody>
    </table>

    <p class="section-title">Deductions</p>
    <table>
      <tbody>
        <tr><td>PAYE Tax</td><td>-${formatNaira(payload.finalSettlement?.taxOnSettlement || payload.taxDeduction)}</td></tr>
        <tr><td>Pension</td><td>-${formatNaira(payload.pensionDeduction)}</td></tr>
        <tr><td>NHF</td><td>-${formatNaira(payload.nhfDeduction)}</td></tr>
        <tr><td>Outstanding Loan Repayment</td><td>-${formatNaira(payload.finalSettlement?.loanDeduction || 0)}</td></tr>
      </tbody>
    </table>

    <div class="net">
      <p>Net Final Settlement</p>
      <p class="amount">${formatNaira(payload.finalSettlement?.netSettlement || payload.netPay)}</p>
    </div>
  </body>
</html>`;
  }

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
        <tr><th>Earnings</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${(payload.earningsLines || [{ component: 'Gross Pay', amount: payload.grossPay }])
          .map(
            (line) =>
              `<tr><td>${line.component}${line.taxable ? ' ●' : ''}</td><td>${formatNaira(Number(line.amount || 0))}</td></tr>`
          )
          .join('')}
        <tr><td><strong>Gross Pay</strong></td><td><strong>${formatNaira(payload.grossPay)}</strong></td></tr>
      </tbody>
    </table>

    <table style="margin-top: 16px;">
      <thead>
        <tr><th>Deductions</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr><td>PAYE Tax</td><td>-${formatNaira(payload.taxDeduction)}</td></tr>
        <tr><td>Pension</td><td>-${formatNaira(payload.pensionDeduction)}</td></tr>
        <tr><td>NHF</td><td>-${formatNaira(payload.nhfDeduction)}</td></tr>
        <tr><td>Total Deductions</td><td>-${formatNaira(payload.deductions)}</td></tr>
      </tbody>
    </table>

    <table style="margin-top: 16px;">
      <tbody>
        <tr><td>Taxable Income</td><td>${formatNaira(payload.taxableIncome || 0)}</td></tr>
        <tr><td>Pension Base</td><td>${formatNaira(payload.pensionBase || 0)}</td></tr>
        <tr><td>Employer Pension (not deducted)</td><td>${formatNaira(payload.employerPension || 0)}</td></tr>
      </tbody>
    </table>

    <p class="muted">Days worked: ${payload.daysWorked || 0}/${payload.totalWorkingDays || 0} · Overtime: ${payload.overtimeHours || 0} hrs · Absences: ${payload.daysAbsent || 0}</p>

    <div class="total">
      <div class="label">Net Salary</div>
      <div class="net">${formatNaira(payload.netPay)}</div>
    </div>
  </body>
</html>`;
}

export const createPayrollRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  app.get('/settings/payroll-components', async (c) => {
    const tenantId = c.get('tenantId');
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, tenant_id, name, code, type, frequency,
              is_taxable, is_pensionable, is_nhf_applicable,
              percentage_base, percentage_value,
              display_on_payslip, sort_order, description,
              is_active, created_by, created_at, updated_at
         FROM payroll_components
        WHERE tenant_id = $1
        ORDER BY sort_order ASC, name ASC`,
      tenantId
    );

    return c.json({ success: true, data: rows });
  });

  app.post('/settings/payroll-components', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    try {
      const payload = payrollComponentSchema.parse(await c.req.json());
      const id = randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO payroll_components (
            id, tenant_id, name, code, type, frequency,
            is_taxable, is_pensionable, is_nhf_applicable,
            percentage_base, percentage_value,
            display_on_payslip, sort_order, description,
            is_active, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5::component_type, $6::component_frequency,
            $7, $8, $9, $10, $11, $12, $13, $14, true, $15, now(), now()
          )`,
        id,
        tenantId,
        payload.name,
        payload.code,
        payload.type,
        payload.frequency,
        payload.is_taxable,
        payload.is_pensionable,
        payload.is_nhf_applicable,
        payload.percentage_base || null,
        payload.percentage_value || null,
        payload.display_on_payslip,
        payload.sort_order,
        payload.description || null,
        userId
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CREATE',
          resource: 'payroll_component',
          resourceId: id,
          changes: payload,
        },
      });

      return c.json({ success: true, data: { id }, message: 'Payroll component created' }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid component payload', details: error.errors } }, 400);
      }

      return c.json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create payroll component' } }, 500);
    }
  });

  app.patch('/settings/payroll-components/:id', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN']);
    if (denied) return denied;

    const id = c.req.param('id');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    try {
      const payload = payrollComponentPatchSchema.parse(await c.req.json());
      const rows = await prisma.$queryRawUnsafe<Array<{ code: string; type: string }>>(
        `SELECT code, type FROM payroll_components WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        id,
        tenantId
      );

      const existing = rows[0];
      if (!existing) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Component not found' } }, 404);
      }

      if ((existing.code === 'BASIC' || existing.type === 'BASIC') && payload.is_taxable === false) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'BASIC component must remain taxable' } }, 400);
      }

      await prisma.$executeRawUnsafe(
        `UPDATE payroll_components
            SET name = COALESCE($3, name),
                type = COALESCE($4::component_type, type),
                frequency = COALESCE($5::component_frequency, frequency),
                is_taxable = COALESCE($6, is_taxable),
                is_pensionable = COALESCE($7, is_pensionable),
                is_nhf_applicable = COALESCE($8, is_nhf_applicable),
                percentage_base = CASE WHEN $9::text IS NULL THEN percentage_base ELSE $9 END,
                percentage_value = CASE WHEN $10::numeric IS NULL THEN percentage_value ELSE $10 END,
                display_on_payslip = COALESCE($11, display_on_payslip),
                sort_order = COALESCE($12, sort_order),
                description = CASE WHEN $13::text IS NULL THEN description ELSE $13 END,
                is_active = COALESCE($14, is_active),
                updated_at = now()
          WHERE id = $1 AND tenant_id = $2`,
        id,
        tenantId,
        payload.name ?? null,
        payload.type ?? null,
        payload.frequency ?? null,
        payload.is_taxable ?? null,
        payload.is_pensionable ?? null,
        payload.is_nhf_applicable ?? null,
        payload.percentage_base ?? null,
        payload.percentage_value ?? null,
        payload.display_on_payslip ?? null,
        payload.sort_order ?? null,
        payload.description ?? null,
        (payload as Record<string, unknown>).is_active ?? null
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'UPDATE',
          resource: 'payroll_component',
          resourceId: id,
          changes: payload,
        },
      });

      return c.json({ success: true, message: 'Payroll component updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid component update payload', details: error.errors } }, 400);
      }

      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update payroll component' } }, 500);
    }
  });

  app.delete('/settings/payroll-components/:id', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN']);
    if (denied) return denied;

    const id = c.req.param('id');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const rows = await prisma.$queryRawUnsafe<Array<{ code: string; type: string }>>(
      `SELECT code, type FROM payroll_components WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      id,
      tenantId
    );

    const existing = rows[0];
    if (!existing) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Component not found' } }, 404);
    }

    if (['BASIC', 'OVERTIME'].includes(existing.code) || ['BASIC', 'OVERTIME', 'STATUTORY'].includes(existing.type)) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'This component cannot be deleted' } }, 400);
    }

    const assignmentCount = await prisma.$queryRawUnsafe<Array<{ count: unknown }>>(
      `SELECT COUNT(*)::int AS count
         FROM employee_components
        WHERE component_id = $1
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
      id
    );

    if (Number(assignmentCount[0]?.count || 0) > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE payroll_components SET is_active = false, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
        id,
        tenantId
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'UPDATE',
          resource: 'payroll_component',
          resourceId: id,
          changes: { is_active: false, reason: 'has_active_assignments' },
        },
      });

      return c.json({ success: true, message: 'Component deactivated because it has active assignments' });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM payroll_components WHERE id = $1 AND tenant_id = $2`, id, tenantId);

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'DELETE',
        resource: 'payroll_component',
        resourceId: id,
      },
    });

    return c.json({ success: true, message: 'Component deleted' });
  });

  app.post('/settings/payroll-components/:id/bulk-assign', async (c) => {
    const denied = requireAnyRole(c, ['SUPER_ADMIN']);
    if (denied) return denied;

    const componentId = c.req.param('id');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    try {
      const payload = bulkAssignSchema.parse(await c.req.json());

      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: 'ACTIVE',
          ...(payload.departmentId ? { departmentId: payload.departmentId } : {}),
          ...(payload.locationId ? { locationId: payload.locationId } : {}),
        },
        select: { id: true },
      });

      await Promise.all(
        employees.map((employee) =>
          prisma.$executeRawUnsafe(
            `INSERT INTO employee_components (
                id, tenant_id, employee_id, component_id, amount, effective_from, created_by, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, now())
              ON CONFLICT (employee_id, component_id, effective_from)
              DO UPDATE SET amount = EXCLUDED.amount`,
            randomUUID(),
            tenantId,
            employee.id,
            componentId,
            payload.amount,
            payload.effectiveFrom,
            userId
          )
        )
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CREATE',
          resource: 'employee_component_bulk_assignment',
          resourceId: componentId,
          changes: { ...payload, employees: employees.length },
        },
      });

      return c.json({ success: true, message: `Assigned to ${employees.length} employees` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid bulk assignment payload', details: error.errors } }, 400);
      }

      return c.json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to bulk assign component' } }, 500);
    }
  });

  app.get('/employees/:id/components', async (c) => {
    const employeeId = c.req.param('id');
    const tenantId = c.get('tenantId');
    const asOfDate = c.req.query('asOfDate') || new Date().toISOString().slice(0, 10);

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
          ec.id,
          ec.employee_id,
          ec.component_id,
          ec.amount,
          ec.effective_from,
          ec.effective_to,
          pc.name,
          pc.code,
          pc.type,
          pc.frequency,
          pc.is_taxable,
          pc.is_pensionable,
          pc.is_nhf_applicable,
          pc.display_on_payslip,
          pc.sort_order
       FROM employee_components ec
       JOIN payroll_components pc ON pc.id = ec.component_id
      WHERE ec.employee_id = $1
        AND ec.tenant_id = $2
        AND ec.effective_from <= $3::date
        AND (ec.effective_to IS NULL OR ec.effective_to >= $3::date)
        AND pc.is_active = true
      ORDER BY pc.sort_order ASC, pc.name ASC`,
      employeeId,
      tenantId,
      asOfDate
    );

    return c.json({ success: true, data: rows });
  });

  app.post('/employees/:id/components', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const employeeId = c.req.param('id');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    try {
      const payload = employeeComponentSchema.parse(await c.req.json());
      const id = randomUUID();

      await prisma.$executeRawUnsafe(
        `INSERT INTO employee_components (
            id, tenant_id, employee_id, component_id, amount, effective_from, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, now())`,
        id,
        tenantId,
        employeeId,
        payload.componentId,
        payload.amount || 0,
        payload.effectiveFrom,
        userId
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CREATE',
          resource: 'employee_component',
          resourceId: id,
          changes: { employeeId, ...payload },
        },
      });

      return c.json({ success: true, data: { id }, message: 'Component assigned to employee' }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid assignment payload', details: error.errors } }, 400);
      }

      return c.json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to assign component' } }, 500);
    }
  });

  app.patch('/employees/:id/components/:componentId', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const employeeId = c.req.param('id');
    const componentId = c.req.param('componentId');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    try {
      const payload = employeeComponentPatchSchema.parse(await c.req.json());

      await prisma.$executeRawUnsafe(
        `UPDATE employee_components
            SET amount = COALESCE($4, amount),
                effective_from = COALESCE($5::date, effective_from),
                effective_to = CASE WHEN $6::text IS NULL THEN effective_to ELSE $6::date END
          WHERE tenant_id = $1
            AND employee_id = $2
            AND component_id = $3
            AND effective_to IS NULL`,
        tenantId,
        employeeId,
        componentId,
        payload.amount ?? null,
        payload.effectiveFrom ?? null,
        payload.effectiveTo ?? null
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'UPDATE',
          resource: 'employee_component',
          resourceId: `${employeeId}:${componentId}`,
          changes: payload,
        },
      });

      return c.json({ success: true, message: 'Employee component updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid update payload', details: error.errors } }, 400);
      }

      return c.json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update employee component' } }, 500);
    }
  });

  app.delete('/employees/:id/components/:componentId', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const employeeId = c.req.param('id');
    const componentId = c.req.param('componentId');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    await prisma.$executeRawUnsafe(
      `UPDATE employee_components
          SET effective_to = CURRENT_DATE
        WHERE tenant_id = $1
          AND employee_id = $2
          AND component_id = $3
          AND effective_to IS NULL`,
      tenantId,
      employeeId,
      componentId
    );

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'DELETE',
        resource: 'employee_component',
        resourceId: `${employeeId}:${componentId}`,
      },
    });

    return c.json({ success: true, message: 'Employee component removed' });
  });

  app.get('/runs/:id/components', async (c) => {
    const runId = c.req.param('id');
    const tenantId = c.get('tenantId');

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
          e.id AS employee_id,
          e."employeeId" AS staff_id,
          concat(e."firstName", ' ', e."lastName") AS employee_name,
          pc.id AS component_id,
          pc.name AS component_name,
          pc.code AS component_code,
          pc.frequency,
          prc.amount
       FROM "Employee" e
       JOIN employee_components ec
         ON ec.employee_id = e.id
        AND ec.tenant_id = e."tenantId"
        AND ec.effective_to IS NULL
       JOIN payroll_components pc
         ON pc.id = ec.component_id
        AND pc.tenant_id = e."tenantId"
        AND pc.is_active = true
       LEFT JOIN payroll_run_components prc
         ON prc.payroll_run_id = $1
        AND prc.employee_id = e.id
        AND prc.component_id = pc.id
      WHERE e."tenantId" = $2
        AND e."employmentStatus" = 'ACTIVE'
        AND pc.frequency = 'VARIABLE'
      ORDER BY employee_name ASC, pc.sort_order ASC`,
      runId,
      tenantId
    );

    return c.json({ success: true, data: rows });
  });

  app.put('/runs/:id/components', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const runId = c.req.param('id');
    const userId = c.get('userId');

    const body = (await c.req.json().catch(() => ({ items: [] }))) as {
      items?: Array<{ employeeId: string; componentId: string; amount: number; note?: string }>;
    };

    const items = Array.isArray(body.items) ? body.items : [];

    await Promise.all(
      items.map((item) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO payroll_run_components (
              id, payroll_run_id, employee_id, component_id, amount, note, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
            ON CONFLICT (payroll_run_id, employee_id, component_id)
            DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note`,
          randomUUID(),
          runId,
          item.employeeId,
          item.componentId,
          Number(item.amount || 0),
          item.note || null,
          userId
        )
      )
    );

    return c.json({ success: true, message: 'Run variable components saved' });
  });

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

      // Get all active employees while excluding workers who exited before this payroll window.
      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: 'ACTIVE',
          OR: [
            { terminationDate: null },
            { terminationDate: { gte: run.startDate } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          salary: true,
          hireDate: true,
          terminationDate: true,
        },
      });

      // Generate payslips
      const payslips = await Promise.all(
        employees.map(async (emp) => {
          const monthlySalary = Number(emp.salary || 0);
          const attendance = await getAttendanceSummary(
            emp.id,
            run.startDate.toISOString(),
            run.endDate.toISOString(),
            tenantId
          );

          const hasExitInPeriod = !!emp.terminationDate && emp.terminationDate <= run.endDate;

          const computed = hasExitInPeriod
            ? await calculateProratedPayroll({
                employeeId: emp.id,
                tenantId,
                salary: monthlySalary,
                basicSalary: monthlySalary,
                hireDate: emp.hireDate,
                terminationDate: emp.terminationDate as Date,
                periodStart: run.startDate.toISOString(),
                periodEnd: run.endDate.toISOString(),
                attendance,
              })
            : await calculateEmployeePayroll(
                emp.id,
                id,
                run.startDate.toISOString(),
                run.endDate.toISOString(),
                tenantId
              );
          const computedAny = computed as unknown as Record<string, unknown>;
          const totalDeductions = Number(
            computedAny.totalDeductions ?? computedAny.deductions ?? 0
          );

          const isProrated = hasExitInPeriod;

          const earnings = isProrated
            ? [
                {
                  component: `Prorated Basic (${(computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).workedDays} of ${(computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).totalWorkingDays} working days)`,
                  amount: (computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).proratedSalary,
                },
                {
                  component: `Unused Annual Leave Payout (${(computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).unusedLeaveDays} days)`,
                  amount: (computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).unusedLeavePayout,
                },
                { component: 'Gratuity', amount: (computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).gratuity },
              ]
            : (computed as Awaited<ReturnType<typeof calculateEmployeePayroll>>).earnings
                .filter((line) => line.display_on_payslip !== false)
                .map((line) => ({
                  component: line.name,
                  code: line.code,
                  amount: line.amount,
                  taxable: line.is_taxable,
                  pensionable: line.is_pensionable,
                  nhf: line.is_nhf,
                }));

          const nonProrated = computed as Awaited<ReturnType<typeof calculateEmployeePayroll>>;

          const deductionDetails = [
            { component: 'PAYE Tax', amount: Number((computedAny.monthlyPAYE ?? computedAny.payeTax) || 0) },
            { component: 'Pension', amount: Number((computedAny.employeePension ?? computedAny.pension) || 0) },
            { component: 'NHF', amount: Number(computedAny.nhf || 0) },
            ...(isProrated
              ? [{ component: 'Outstanding Loan Repayment', amount: (computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).loanDeduction }]
              : []),
          ];

          const notes = {
            attendanceSummary: attendance,
            attendanceRate: attendance.attendanceRate,
            isProrated,
            ...(isProrated
              ? {}
              : {
                  taxableIncome: nonProrated.taxableIncome,
                  pensionBase: nonProrated.pensionBase,
                  nhfBase: nonProrated.nhfBase,
                  employerPension: nonProrated.employerPension,
                  nsitf: nonProrated.nsitf,
                  overtimeHours: nonProrated.meta.overtimeHours,
                  daysAbsent: nonProrated.meta.daysAbsent,
                }),
            ...(isProrated
              ? {
                  finalSettlement: (computed as Awaited<ReturnType<typeof calculateProratedPayroll>>).finalSettlement,
                  exitDate: emp.terminationDate,
                }
              : {}),
          };
              const notesJson = JSON.stringify(notes);

          return prisma.payslip.upsert({
            where: {
              employeeId_payrollRunId: {
                employeeId: emp.id,
                payrollRunId: id,
              },
            },
            update: {
              grossPay: computed.grossPay,
              deductions: totalDeductions,
              netPay: computed.netPay,
              earnings,
              deductionDetails: [...deductionDetails, { component: 'Meta', amount: 0, notes: notesJson }],
              pdfUrl: payslipStorageUrl(tenantId, id, `employee-${emp.id}`),
            },
            create: {
              tenantId,
              payrollRunId: id,
              employeeId: emp.id,
              grossPay: computed.grossPay,
              deductions: totalDeductions,
              netPay: computed.netPay,
              earnings,
              deductionDetails: [...deductionDetails, { component: 'Meta', amount: 0, notes: notesJson }],
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
      const earningsRows = Array.isArray(payslip.earnings) ? payslip.earnings : [];
      const metaEntry = (details as Array<{ component?: unknown; notes?: unknown }>).find(
        (row) => String(row.component || '').toUpperCase() === 'META'
      );
      const metaNotes =
        typeof metaEntry?.notes === 'string'
          ? (() => {
              try {
                return JSON.parse(metaEntry.notes) as Record<string, unknown>;
              } catch {
                return null;
              }
            })()
          : null;
      const finalSettlement =
        metaNotes && typeof metaNotes.finalSettlement === 'object'
          ? (metaNotes.finalSettlement as {
              proratedSalary?: number;
              unusedLeavePayout?: number;
              gratuity?: number;
              grossSettlement?: number;
              taxOnSettlement?: number;
              loanDeduction?: number;
              netSettlement?: number;
            })
          : null;
          const metaObj = (metaNotes && typeof metaNotes === 'object' ? (metaNotes as Record<string, any>) : {}) as Record<string, any>;
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
        earningsLines: (earningsRows as Array<Record<string, unknown>>).map((row) => ({
          component: String(row.component || row.name || 'Earning'),
          amount: Number(row.amount || 0),
          taxable: Boolean(row.taxable || row.is_taxable),
        })),
        taxableIncome: Number(metaObj.taxableIncome || 0),
        pensionBase: Number(metaObj.pensionBase || 0),
        employerPension: Number(metaObj.employerPension || 0),
        daysWorked: Number(metaObj.attendanceSummary?.totalWorkedDays || 0),
        totalWorkingDays: Number(metaObj.attendanceSummary?.totalWorkingDays || 0),
        overtimeHours: Number(metaObj.overtimeHours || 0),
        daysAbsent: Number(metaObj.daysAbsent || 0),
        finalSettlement,
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

  app.get('/reports/paye-schedule', async (c) => {
    const tenantId = c.get('tenantId');
    const runId = c.req.query('runId');

    if (!runId) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'runId is required' } }, 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: runId, tenantId },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    const rows = payslips.map((slip) => {
      const details = Array.isArray(slip.deductionDetails) ? (slip.deductionDetails as Array<Record<string, unknown>>) : [];
      const meta = details.find((item) => String(item.component || '').toUpperCase() === 'META');
      const parsedMeta =
        typeof meta?.notes === 'string'
          ? (() => {
              try {
                return JSON.parse(meta.notes as string) as Record<string, unknown>;
              } catch {
                return {} as Record<string, unknown>;
              }
            })()
          : {};
      const paye = Number(details.find((item) => String(item.component || '').toUpperCase() === 'PAYE TAX')?.amount || 0);

      return {
        employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`.trim(),
        staffId: slip.employee.employeeId,
        grossIncome: Number(slip.grossPay),
        taxableIncome: Number((parsedMeta as Record<string, unknown>).taxableIncome || slip.grossPay),
        paye,
      };
    });

    const format = (c.req.query('format') || '').toLowerCase();
    const headers = ['Employee Name', 'Staff ID', 'Gross Income', 'Taxable Income', 'PAYE'];
    const reportRows = rows.map((row) => [row.employeeName, row.staffId, row.grossIncome, row.taxableIncome, row.paye]);

    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="paye-schedule.csv"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'excel' || format === 'xlsx') {
      c.header('Content-Type', 'application/vnd.ms-excel');
      c.header('Content-Disposition', 'attachment; filename="paye-schedule.xls"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'pdf') {
      c.header('Content-Type', 'text/html; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="paye-schedule-printable.html"');
      c.header('X-Export-Notice', 'Printable HTML export returned for PDF requests.');
      return c.body(buildReportHtml('PAYE Schedule', headers, reportRows));
    }

    return c.json({ success: true, data: rows });
  });

  app.get('/reports/pension-schedule', async (c) => {
    const tenantId = c.get('tenantId');
    const runId = c.req.query('runId');

    if (!runId) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'runId is required' } }, 400);
    }

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: runId, tenantId },
      include: { employee: { select: { firstName: true, lastName: true, employeeId: true } } },
    });

    const rows = payslips.map((slip) => {
      const details = Array.isArray(slip.deductionDetails) ? (slip.deductionDetails as Array<Record<string, unknown>>) : [];
      const meta = details.find((item) => String(item.component || '').toUpperCase() === 'META');
      const parsedMeta =
        typeof meta?.notes === 'string'
          ? (() => {
              try {
                return JSON.parse(meta.notes as string) as Record<string, unknown>;
              } catch {
                return {} as Record<string, unknown>;
              }
            })()
          : {};
      const pensionBase = Number((parsedMeta as Record<string, unknown>).pensionBase || 0);
      const employeePension = Number(details.find((item) => String(item.component || '').toUpperCase() === 'PENSION')?.amount || 0);

      return {
        employeeName: `${slip.employee.firstName} ${slip.employee.lastName}`.trim(),
        staffId: slip.employee.employeeId,
        pensionBase,
        employeePension,
        employerPension: Math.round(pensionBase * 0.1 * 100) / 100,
        total: Math.round((employeePension + pensionBase * 0.1) * 100) / 100,
      };
    });

    const format = (c.req.query('format') || '').toLowerCase();
    const headers = ['Employee Name', 'Staff ID', 'Pension Base', 'Employee 8%', 'Employer 10%', 'Total'];
    const reportRows = rows.map((row) => [row.employeeName, row.staffId, row.pensionBase, row.employeePension, row.employerPension, row.total]);

    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="pension-schedule.csv"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'excel' || format === 'xlsx') {
      c.header('Content-Type', 'application/vnd.ms-excel');
      c.header('Content-Disposition', 'attachment; filename="pension-schedule.xls"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'pdf') {
      c.header('Content-Type', 'text/html; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="pension-schedule-printable.html"');
      c.header('X-Export-Notice', 'Printable HTML export returned for PDF requests.');
      return c.body(buildReportHtml('Pension Schedule', headers, reportRows));
    }

    return c.json({ success: true, data: rows });
  });

  app.get('/reports/payroll-summary', async (c) => {
    const tenantId = c.get('tenantId');
    const runId = c.req.query('runId');

    if (!runId) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'runId is required' } }, 400);
    }

    const payslips = await prisma.payslip.findMany({ where: { payrollRunId: runId, tenantId } });

    const componentMap = new Map<string, { component: string; employees: Set<string>; total: number }>();
    let payrollTotal = 0;
    let payeTotal = 0;
    let pensionTotal = 0;
    let nhfTotal = 0;

    for (const slip of payslips) {
      payrollTotal += Number(slip.grossPay);
      const earnings = Array.isArray(slip.earnings) ? (slip.earnings as Array<Record<string, unknown>>) : [];
      const deductions = Array.isArray(slip.deductionDetails)
        ? (slip.deductionDetails as Array<Record<string, unknown>>)
        : [];

      for (const row of earnings) {
        const component = String(row.component || row.name || 'Unknown');
        const amount = Number(row.amount || 0);
        if (!componentMap.has(component)) {
          componentMap.set(component, { component, employees: new Set<string>(), total: 0 });
        }
        const entry = componentMap.get(component)!;
        entry.total += amount;
        entry.employees.add(slip.employeeId);
      }

      payeTotal += Number(deductions.find((row) => String(row.component || '').toUpperCase() === 'PAYE TAX')?.amount || 0);
      pensionTotal += Number(deductions.find((row) => String(row.component || '').toUpperCase() === 'PENSION')?.amount || 0);
      nhfTotal += Number(deductions.find((row) => String(row.component || '').toUpperCase() === 'NHF')?.amount || 0);
    }

    const componentRows = Array.from(componentMap.values())
      .map((entry) => ({
        component: entry.component,
        employees: entry.employees.size,
        totalAmount: Math.round(entry.total * 100) / 100,
        percentOfPayroll: payrollTotal > 0 ? Math.round((entry.total / payrollTotal) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const payload = {
      success: true,
      data: {
        components: componentRows,
        totals: {
          grossPayroll: Math.round(payrollTotal * 100) / 100,
          paye: Math.round(payeTotal * 100) / 100,
          pensionEmployee: Math.round(pensionTotal * 100) / 100,
          pensionEmployer: Math.round(pensionTotal * 1.25 * 100) / 100,
          nhf: Math.round(nhfTotal * 100) / 100,
          nsitf: Math.round(payrollTotal * 0.01 * 100) / 100,
        },
      },
    };

    const format = (c.req.query('format') || '').toLowerCase();
    if (!format) {
      return c.json(payload);
    }

    const headers = ['Component', 'Employees', 'Total Amount', 'Percent Of Payroll'];
    const reportRows = componentRows.map((row) => [row.component, row.employees, row.totalAmount, `${row.percentOfPayroll}%`]);

    if (format === 'csv') {
      c.header('Content-Type', 'text/csv');
      c.header('Content-Disposition', 'attachment; filename="payroll-summary-components.csv"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'excel' || format === 'xlsx') {
      c.header('Content-Type', 'application/vnd.ms-excel');
      c.header('Content-Disposition', 'attachment; filename="payroll-summary-components.xls"');
      return c.body(buildCsv(headers, reportRows));
    }

    if (format === 'pdf') {
      c.header('Content-Type', 'text/html; charset=utf-8');
      c.header('Content-Disposition', 'attachment; filename="payroll-summary-printable.html"');
      c.header('X-Export-Notice', 'Printable HTML export returned for PDF requests.');
      return c.body(buildReportHtml('Payroll Component Summary', headers, reportRows));
    }

    return c.json(payload);
  });

  return app;
};
