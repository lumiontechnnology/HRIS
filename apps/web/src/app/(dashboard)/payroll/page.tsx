'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

interface PayrollRow {
  id: string;
  employee: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  tax: number;
  netPay: number;
  state: 'Draft' | 'Processing' | 'Review' | 'Approved' | 'Disbursed';
}

function formatMoney(value: number): string {
  return `NGN ${value.toLocaleString()}`;
}

interface PayrollSummaryResponse {
  data: {
    totalEmployees: number;
    thisMonthPayroll: number;
    lastMonthPayroll: number;
    totalPayslips: number;
    currentRunStatus: string;
  };
}

interface PayrollPayslipsResponse {
  data: Array<{
    id: string;
    grossPay: number;
    deductions: number;
    netPay: number;
    earnings?: Array<{ component?: string; amount?: number }> | null;
    deductionDetails?: Array<{ component?: string; amount?: number }> | null;
    employee?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
    payrollRun?: {
      status?: string;
    } | null;
  }>;
}

function mapPayrollState(value: string | undefined): PayrollRow['state'] {
  if (value === 'DISBURSED' || value === 'LOCKED') return 'Disbursed';
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REVIEW') return 'Review';
  if (value === 'PROCESSING') return 'Processing';
  return 'Draft';
}

export default function PayrollPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['ui-payroll', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const [summaryResponse, payslipsResponse] = await Promise.all([
        fetchDashboardApi<PayrollSummaryResponse>(
          '/api/v1/payroll/summary',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
        fetchDashboardApi<PayrollPayslipsResponse>(
          '/api/v1/payroll/payslips?limit=200',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
      ]);

      const rows: PayrollRow[] = payslipsResponse.data.map((item) => {
        const allowances = (item.earnings || []).reduce((sum, earning) => {
          const label = (earning.component || '').toLowerCase();
          const amount = Number(earning.amount || 0);
          return label.includes('basic') ? sum : sum + amount;
        }, 0);

        const tax = (item.deductionDetails || []).reduce((sum, detail) => {
          const label = (detail.component || '').toLowerCase();
          const amount = Number(detail.amount || 0);
          return label.includes('tax') ? sum + amount : sum;
        }, 0);

        return {
          id: item.id,
          employee:
            `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`.trim() ||
            'Unknown Employee',
          baseSalary: Number(item.grossPay || 0),
          allowances,
          deductions: Number(item.deductions || 0),
          tax,
          netPay: Number(item.netPay || 0),
          state: mapPayrollState(item.payrollRun?.status),
        };
      });

      return {
        summary: summaryResponse.data,
        rows,
      };
    },
  });

  const effectiveRows = data?.rows ?? [];

  const columns: ColumnDef<PayrollRow>[] = [
    { key: 'employee', label: 'Employee', sortable: true },
    { key: 'baseSalary', label: 'Base Salary', sortable: true, render: (row) => formatMoney(row.baseSalary) },
    { key: 'allowances', label: 'Allowances', sortable: true, render: (row) => formatMoney(row.allowances) },
    { key: 'deductions', label: 'Deductions', sortable: true, render: (row) => formatMoney(row.deductions) },
    { key: 'tax', label: 'Tax', sortable: true, render: (row) => formatMoney(row.tax) },
    { key: 'netPay', label: 'Net Pay', sortable: true, render: (row) => formatMoney(row.netPay) },
    {
      key: 'state',
      label: 'Workflow State',
      sortable: true,
      render: (row) => (
        <Badge
          tone={
            row.state === 'Disbursed'
              ? 'success'
              : row.state === 'Approved'
                ? 'info'
                : row.state === 'Review'
                  ? 'warning'
                  : 'neutral'
          }
        >
          {row.state}
        </Badge>
      ),
    },
  ];

  const totals = useMemo(() => {
    const totalTax = effectiveRows.reduce((sum, row) => sum + row.tax, 0);
    const totalDeductions = effectiveRows.reduce((sum, row) => sum + row.deductions, 0);

    return {
      totalPayroll: data?.summary?.thisMonthPayroll ?? effectiveRows.reduce((sum, row) => sum + row.netPay, 0),
      totalTax,
      totalDeductions,
    };
  }, [data?.summary?.thisMonthPayroll, effectiveRows]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payroll"
        description="Financially accurate payroll operations with controlled state transitions."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Payroll</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">{formatMoney(totals.totalPayroll)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tax</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">{formatMoney(totals.totalTax)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Deductions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold text-foreground tabular-nums">{formatMoney(totals.totalDeductions)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Workflow</CardTitle>
          <CardDescription>Draft → Processing → Review → Approved → Disbursed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-5">
            {['Draft', 'Processing', 'Review', 'Approved', 'Disbursed'].map((state) => (
              <div key={state} className="rounded border border-border bg-muted/30 px-2 py-2">
                {state}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Register</CardTitle>
          <CardDescription>Sortable and filterable payroll detail table</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <DataTable
              rows={effectiveRows}
              columns={columns}
              searchKeys={['employee', 'state']}
              searchPlaceholder="Search employee or workflow state"
              emptyTitle="No payroll rows"
              emptyDescription="Generate payroll rows to start this cycle."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
