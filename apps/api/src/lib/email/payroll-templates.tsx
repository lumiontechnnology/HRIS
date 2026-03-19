import * as React from 'react';
import { render } from '@react-email/render';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
  Link,
} from '@react-email/components';

// ─── Primitive helpers ────────────────────────────────────────────────────────

function formatNaira(value: number): string {
  return `NGN ${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function EmailLayout({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>Lumion HRIS</Text>
            <Heading as="h1" style={styles.heading}>
              {title}
            </Heading>
          </Section>
          <Hr style={styles.hr} />
          <Section style={styles.content}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <Row style={styles.field}>
      <Column style={styles.fieldLabel}>
        <Text style={styles.fieldLabelText}>{label}</Text>
      </Column>
      <Column>
        <Text style={styles.fieldValue}>{String(value)}</Text>
      </Column>
    </Row>
  );
}

// ─── Payroll submitted ────────────────────────────────────────────────────────

function PayrollSubmittedEmail(payload: {
  period: string;
  runId: string;
  totalEmployees: number;
  totalGross: number;
}) {
  return (
    <EmailLayout
      preview={`Payroll run for ${payload.period} is ready for HR review`}
      title={`Payroll Ready for Review — ${payload.period}`}
    >
      <Text style={styles.intro}>
        A payroll run has been submitted and is waiting for your review.
      </Text>
      <Section style={styles.details}>
        <Field label="Period" value={payload.period} />
        <Field label="Run ID" value={payload.runId} />
        <Field label="Employees" value={payload.totalEmployees} />
        <Field label="Total Gross" value={formatNaira(payload.totalGross)} />
      </Section>
      <Text style={styles.cta}>
        Open <strong>Lumion HRIS</strong> and navigate to Payroll → Runs to review it.
      </Text>
    </EmailLayout>
  );
}

// ─── Step approved ────────────────────────────────────────────────────────────

function PayrollStepApprovedEmail(payload: {
  period: string;
  runId: string;
  approvedBy: string;
  nextRole: string;
}) {
  return (
    <EmailLayout
      preview={`Action required: payroll approval for ${payload.period}`}
      title="Action Required — Payroll Approval"
    >
      <Text style={styles.intro}>
        A payroll approval step was completed and your review is now required.
      </Text>
      <Section style={styles.details}>
        <Field label="Period" value={payload.period} />
        <Field label="Run ID" value={payload.runId} />
        <Field label="Previous Approver" value={payload.approvedBy} />
        <Field label="Required Role" value={payload.nextRole} />
      </Section>
      <Text style={styles.cta}>
        Open{' '}
        <Link href={`/payroll/runs/${payload.runId}`} style={styles.link}>
          /payroll/runs/{payload.runId}
        </Link>{' '}
        in Lumion HRIS to continue.
      </Text>
    </EmailLayout>
  );
}

// ─── Payroll rejected ─────────────────────────────────────────────────────────

function PayrollRejectedEmail(payload: {
  period: string;
  runId: string;
  rejectedBy: string;
  reason: string;
}) {
  return (
    <EmailLayout
      preview={`Payroll run for ${payload.period} has been rejected`}
      title={`Payroll Run Rejected — ${payload.period}`}
    >
      <Text style={styles.intro}>A payroll run has been rejected and requires your attention.</Text>
      <Section style={styles.details}>
        <Field label="Period" value={payload.period} />
        <Field label="Run ID" value={payload.runId} />
        <Field label="Rejected By" value={payload.rejectedBy} />
      </Section>
      <Section style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Reason</Text>
        <Text style={styles.reasonText}>{payload.reason}</Text>
      </Section>
      <Text style={styles.cta}>Please review and create a new payroll run for this period.</Text>
    </EmailLayout>
  );
}

// ─── Payroll disbursed (employee payslip notification) ────────────────────────

function PayrollDisbursedEmail(payload: {
  period: string;
  netPay: number;
  payslipUrl: string;
}) {
  return (
    <EmailLayout
      preview={`Your payslip for ${payload.period} is ready — ${formatNaira(payload.netPay)}`}
      title={`Your Payslip for ${payload.period} Is Ready`}
    >
      <Text style={styles.intro}>Your salary has been disbursed for this period.</Text>
      <Section style={styles.payBadge}>
        <Text style={styles.payLabel}>Net Pay</Text>
        <Text style={styles.payAmount}>{formatNaira(payload.netPay)}</Text>
      </Section>
      <Text style={styles.cta}>
        Download your payslip:{' '}
        <Link href={payload.payslipUrl} style={styles.link}>
          {payload.payslipUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

// ─── Public render helpers ────────────────────────────────────────────────────

export async function payrollSubmittedTemplate(payload: {
  period: string;
  runId: string;
  totalEmployees: number;
  totalGross: number;
}): Promise<string> {
  return render(<PayrollSubmittedEmail {...payload} />);
}

export async function payrollStepApprovedTemplate(payload: {
  period: string;
  runId: string;
  approvedBy: string;
  nextRole: string;
}): Promise<string> {
  return render(<PayrollStepApprovedEmail {...payload} />);
}

export async function payrollRejectedTemplate(payload: {
  period: string;
  runId: string;
  rejectedBy: string;
  reason: string;
}): Promise<string> {
  return render(<PayrollRejectedEmail {...payload} />);
}

export async function payrollDisbursedTemplate(payload: {
  period: string;
  netPay: number;
  payslipUrl: string;
}): Promise<string> {
  return render(<PayrollDisbursedEmail {...payload} />);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  body: {
    backgroundColor: '#f8fafc',
    fontFamily: "'Inter', Arial, sans-serif",
    margin: 0,
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  header: {
    padding: '28px 32px 20px',
  },
  brand: {
    color: '#64748b',
    fontSize: '11px',
    fontWeight: 600 as const,
    letterSpacing: '0.1em',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
  },
  heading: {
    color: '#0f172a',
    fontSize: '22px',
    fontWeight: 600 as const,
    lineHeight: '1.3',
    margin: 0,
  },
  hr: {
    borderColor: '#e2e8f0',
    borderTopWidth: '1px',
    margin: 0,
  },
  content: {
    padding: '24px 32px 32px',
  },
  intro: {
    color: '#334155',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 20px 0',
  },
  details: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '20px',
    padding: '8px 16px',
  },
  field: {
    borderBottom: '1px solid #f1f5f9',
    padding: '8px 0',
  },
  fieldLabel: {
    width: '40%',
  },
  fieldLabelText: {
    color: '#64748b',
    fontSize: '13px',
    margin: 0,
  },
  fieldValue: {
    color: '#0f172a',
    fontSize: '13px',
    fontWeight: 500 as const,
    margin: 0,
  },
  cta: {
    color: '#475569',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '4px 0 0 0',
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
  reasonBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginBottom: '20px',
    padding: '12px 16px',
  },
  reasonLabel: {
    color: '#991b1b',
    fontSize: '11px',
    fontWeight: 600 as const,
    letterSpacing: '0.08em',
    margin: '0 0 4px 0',
    textTransform: 'uppercase' as const,
  },
  reasonText: {
    color: '#7f1d1d',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: 0,
  },
  payBadge: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    marginBottom: '20px',
    padding: '16px',
    textAlign: 'center' as const,
  },
  payLabel: {
    color: '#166534',
    fontSize: '11px',
    fontWeight: 600 as const,
    letterSpacing: '0.08em',
    margin: '0 0 6px 0',
    textTransform: 'uppercase' as const,
  },
  payAmount: {
    color: '#14532d',
    fontSize: '28px',
    fontWeight: 700 as const,
    margin: 0,
  },
} as const;
