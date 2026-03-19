import { Resend } from 'resend';
import {
  payrollDisbursedTemplate,
  payrollRejectedTemplate,
  payrollStepApprovedTemplate,
  payrollSubmittedTemplate,
} from './payroll-templates.js';

export type PayrollNotificationKind =
  | 'submitted'
  | 'step-approved'
  | 'rejected'
  | 'disbursed';

interface NotifyPayload {
  to: string[];
  subject: string;
  lines: string[];
  html?: string;
}

function sendEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function buildText(lines: string[]): string {
  return lines.filter(Boolean).join('\n');
}

async function send(payload: NotifyPayload): Promise<void> {
  if (!sendEnabled() || payload.to.length === 0) {
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: process.env.SMTP_FROM || 'Lumion HRIS <noreply@lumionhris.com>',
    to: payload.to,
    subject: payload.subject,
    text: buildText(payload.lines),
    html: payload.html,
  });
}

export async function notifyPayrollSubmitted(params: {
  to: string[];
  period: string;
  runId: string;
  totalEmployees: number;
  totalGross: number;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Payroll Run Ready for Review - ${params.period}`,
    lines: [
      'A payroll run has been submitted for review.',
      `Period: ${params.period}`,
      `Run ID: ${params.runId}`,
      `Employees: ${params.totalEmployees}`,
      `Gross total: NGN ${params.totalGross.toLocaleString('en-NG')}`,
      '',
      'Review in Lumion HRIS.',
    ],
    html: await payrollSubmittedTemplate(params),
  });
}

export async function notifyPayrollStepApproved(params: {
  to: string[];
  period: string;
  runId: string;
  approvedBy: string;
  nextRole: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Action Required: Payroll Approval - ${params.period}`,
    lines: [
      `Payroll run ${params.runId} for ${params.period} is ready for your action.`,
      `Previous approval by: ${params.approvedBy}`,
      `Required role: ${params.nextRole}`,
      '',
      `Open /payroll/runs/${params.runId} to continue.`,
    ],
    html: await payrollStepApprovedTemplate(params),
  });
}

export async function notifyPayrollRejected(params: {
  to: string[];
  period: string;
  runId: string;
  rejectedBy: string;
  reason: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Payroll Run Rejected - ${params.period}`,
    lines: [
      `Payroll run ${params.runId} was rejected by ${params.rejectedBy}.`,
      `Reason: ${params.reason}`,
      '',
      'Please review and create a new payroll run.',
    ],
    html: await payrollRejectedTemplate(params),
  });
}

export async function notifyPayrollDisbursed(params: {
  to: string[];
  period: string;
  netPay: number;
  payslipUrl: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: `Your Payslip for ${params.period} is Ready`,
    lines: [
      `Your payroll for ${params.period} has been disbursed.`,
      `Net pay: NGN ${params.netPay.toLocaleString('en-NG')}`,
      `Payslip: ${params.payslipUrl}`,
    ],
    html: await payrollDisbursedTemplate(params),
  });
}
