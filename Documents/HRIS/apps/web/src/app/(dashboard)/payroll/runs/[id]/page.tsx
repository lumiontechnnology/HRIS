'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, useToast } from '@lumion/ui';
import Link from 'next/link';
import { ArrowLeft, Zap, CheckCircle, Download } from 'lucide-react';
import { useState } from 'react';

interface Payslip {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  basicSalary: number;
  earnings: number;
  taxDeduction: number;
  insuranceDeduction: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
}

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: 'DRAFT' | 'GENERATED' | 'APPROVED' | 'PROCESSING' | 'PAID';
  totalAmount?: number;
  createdAt: string;
  approvedAt?: string;
  paySchedule: {
    id: string;
    name: string;
    frequency: string;
  };
  payslips: Payslip[];
}

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  GENERATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
};

export default function PayrollRunDetailPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [generatingPayslips, setGeneratingPayslips] = useState(false);
  const [approvingRun, setApprovingRun] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/v1/payroll/runs/${id}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch payroll run');
      }

      return res.json();
    },
    enabled: !!user && !!id,
  });

  const generatePayslips = async () => {
    setGeneratingPayslips(true);
    try {
      const res = await fetch(`http://localhost:3001/api/v1/payroll/runs/${id}/generate-payslips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to generate payslips');
      }

      toast({
        title: 'Success',
        description: 'Payslips generated successfully',
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate payslips',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPayslips(false);
    }
  };

  const approveRun = async () => {
    setApprovingRun(true);
    try {
      const res = await fetch(`http://localhost:3001/api/v1/payroll/runs/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to approve payroll run');
      }

      toast({
        title: 'Success',
        description: 'Payroll run approved successfully',
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve payroll run',
        variant: 'destructive',
      });
    } finally {
      setApprovingRun(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        <Link href="/payroll/runs">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Failed to load payroll run.
        </div>
      </div>
    );
  }

  const run: PayrollRun = data.data;
  const startDate = new Date(run.periodStart);
  const endDate = new Date(run.periodEnd);
  const dueDate = new Date(run.dueDate);
  const createdDate = new Date(run.createdAt);

  const totalBasicSalary = run.payslips.reduce((sum, slip) => sum + slip.basicSalary, 0);
  const totalDeductions = run.payslips.reduce((sum, slip) => sum + slip.totalDeductions, 0);
  const totalNetSalary = run.payslips.reduce((sum, slip) => sum + slip.netSalary, 0);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/payroll/runs">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {run.paySchedule.name}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-block rounded-full px-4 py-2 font-semibold ${statusColors[run.status]}`}>
            {run.status}
          </span>
        </div>
      </div>

      {/* Payroll Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{startDate.toLocaleDateString().split('/')[0]}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {startDate.getFullYear()} • {run.paySchedule.frequency}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Total Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₦{(totalNetSalary / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {run.payslips.length} employees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{dueDate.getDate()}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {dueDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Workflow & Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Workflow</CardTitle>
          <CardDescription>Manage the payroll processing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="font-semibold">Generate Payslips</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Calculate salaries for all active employees
                </p>
              </div>
              <Button
                onClick={generatePayslips}
                disabled={run.status !== 'DRAFT' || generatingPayslips}
                variant={run.status === 'DRAFT' ? 'default' : 'outline'}
              >
                <Zap className="mr-2 h-4 w-4" />
                {generatingPayslips ? 'Generating...' : 'Generate'}
              </Button>
            </div>

            {run.payslips.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="font-semibold">Approve Payroll Run</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Finalize and approve all payslips for processing
                  </p>
                </div>
                <Button
                  onClick={approveRun}
                  disabled={run.status !== 'GENERATED' || approvingRun}
                  variant={run.status === 'GENERATED' ? 'default' : 'outline'}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {approvingRun ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payslips */}
      {run.payslips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payslips ({run.payslips.length})</CardTitle>
            <CardDescription>Details of all generated payslips</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 text-left font-semibold">Employee</th>
                    <th className="pb-3 text-right font-semibold">Basic Salary</th>
                    <th className="pb-3 text-right font-semibold">Tax</th>
                    <th className="pb-3 text-right font-semibold">Insurance</th>
                    <th className="pb-3 text-right font-semibold">Deductions</th>
                    <th className="pb-3 text-right font-semibold">Net Salary</th>
                    <th className="pb-3 text-left font-semibold">Status</th>
                    <th className="pb-3 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips.map((slip) => (
                    <tr
                      key={slip.id}
                      className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <td className="py-3">
                        <p className="font-medium">
                          {slip.employee.firstName} {slip.employee.lastName}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {slip.employee.employeeId}
                        </p>
                      </td>
                      <td className="py-3 text-right">₦{(slip.basicSalary / 1000000).toFixed(2)}M</td>
                      <td className="py-3 text-right text-red-600">
                        -₦{(slip.taxDeduction / 1000000).toFixed(2)}M
                      </td>
                      <td className="py-3 text-right text-red-600">
                        -₦{(slip.insuranceDeduction / 1000000).toFixed(2)}M
                      </td>
                      <td className="py-3 text-right font-medium text-red-600">
                        -₦{(slip.totalDeductions / 1000000).toFixed(2)}M
                      </td>
                      <td className="py-3 text-right font-bold text-green-600">
                        ₦{(slip.netSalary / 1000000).toFixed(2)}M
                      </td>
                      <td className="py-3">
                        <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          {slip.status}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <Link href={`/payroll/payslips/${slip.id}`}>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
                    <td className="py-3">TOTAL</td>
                    <td className="py-3 text-right">₦{(totalBasicSalary / 1000000).toFixed(2)}M</td>
                    <td colSpan={3} />
                    <td className="py-3 text-right text-red-600">
                      -₦{(totalDeductions / 1000000).toFixed(2)}M
                    </td>
                    <td className="py-3 text-right text-green-600">
                      ₦{(totalNetSalary / 1000000).toFixed(2)}M
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payroll Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Created</p>
              <p className="font-semibold">{createdDate.toLocaleDateString()}</p>
            </div>
            {run.approvedAt && (
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Approved</p>
                <p className="font-semibold">{new Date(run.approvedAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
