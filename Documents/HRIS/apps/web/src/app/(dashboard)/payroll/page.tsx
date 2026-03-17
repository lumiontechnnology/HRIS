'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { DollarSign, Users, FileText, Calendar } from 'lucide-react';

export default function PayrollPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/v1/payroll/summary', {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch summary');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const summary = data?.data || {};

  const statusColors = {
    DRAFT: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
    GENERATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    NO_RUN: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Payroll</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage salary runs and employee payslips.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll/payslips">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              View Payslips
            </Button>
          </Link>
          <Link href="/payroll/runs/new">
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              New Payroll Run
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Active Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalEmployees || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">in organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₦{(summary.thisMonthPayroll / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">payroll total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Last Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₦{(summary.lastMonthPayroll / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">payroll total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Payslips Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalPayslips || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Run Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month Status</CardTitle>
          <CardDescription>This month's payroll run</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
                <span
                  className={`mt-1 inline-block rounded-full px-3 py-1 font-semibold ${statusColors[summary.currentRunStatus as keyof typeof statusColors] || statusColors.NO_RUN}`}
                >
                  {summary.currentRunStatus === 'NO_RUN' ? 'No Active Run' : summary.currentRunStatus}
                </span>
              </div>
              <Link href="/payroll/runs">
                <Button variant="outline">View All Runs</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payslips</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Quick access to recently generated payslips.
            </p>
            <Link href="/payroll/payslips">
              <Button variant="outline" className="w-full">
                Browse All Payslips
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payroll Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Manage all payroll runs and their status.
            </p>
            <Link href="/payroll/runs">
              <Button variant="outline" className="w-full">
                View All Runs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
