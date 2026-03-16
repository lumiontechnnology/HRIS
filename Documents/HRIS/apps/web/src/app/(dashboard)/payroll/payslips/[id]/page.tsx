'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import Link from 'next/link';
import { ArrowLeft, Download, Mail } from 'lucide-react';

interface Payslip {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
    jobTitle: { title: string };
    department: { name: string };
  };
  basicSalary: number;
  earnings: number;
  taxDeduction: number;
  insuranceDeduction: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  payrollRun: {
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    status: string;
  };
}

export default function PayslipDetailPage(): JSX.Element {
  const params = useParams();
  const id = params.id as string;
  const { user } = useCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['payslip', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/v1/payroll/payslips/${id}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch payslip');
      }

      return res.json();
    },
    enabled: !!user && !!id,
  });

  const payslip = data?.data as Payslip | undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !payslip) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/payroll/payslips">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Failed to load payslip.
        </div>
      </div>
    );
  }

  const startDate = new Date(payslip.payrollRun.periodStart);
  const endDate = new Date(payslip.payrollRun.periodEnd);
  const dueDate = new Date(payslip.payrollRun.dueDate);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/dashboard/payroll/payslips">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {payslip.employee.firstName} {payslip.employee.lastName}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Payslip • {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Employee Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Employee Info */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Employee ID</p>
                  <p className="font-semibold">{payslip.employee.employeeId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
                  <p className="font-semibold">{payslip.employee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Position</p>
                  <p className="font-semibold">{payslip.employee.jobTitle.title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Department</p>
                  <p className="font-semibold">{payslip.employee.department.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earnings & Deductions */}
          <Card>
            <CardHeader>
              <CardTitle>Earnings & Deductions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Earnings Section */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Earnings</h3>
                <div className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex justify-between">
                    <p className="text-slate-600 dark:text-slate-400">Basic Salary</p>
                    <p className="font-semibold">₦{(payslip.basicSalary / 1000000).toFixed(2)}M</p>
                  </div>
                </div>
              </div>

              {/* Deductions Section */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Deductions</h3>
                <div className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div className="flex justify-between">
                    <p className="text-slate-600 dark:text-slate-400">Tax Deduction (10%)</p>
                    <p className="font-semibold text-red-600">
                      -₦{(payslip.taxDeduction / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-slate-600 dark:text-slate-400">Insurance (5%)</p>
                    <p className="font-semibold text-red-600">
                      -₦{(payslip.insuranceDeduction / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Deductions */}
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                <div className="flex justify-between">
                  <p className="font-semibold">Total Deductions</p>
                  <p className="font-bold text-red-600">
                    -₦{(payslip.totalDeductions / 1000000).toFixed(2)}M
                  </p>
                </div>
              </div>

              {/* Net Salary */}
              <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                <div className="flex justify-between">
                  <p className="font-bold">NET SALARY</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₦{(payslip.netSalary / 1000000).toFixed(2)}M
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payroll Period Info */}
          <Card>
            <CardHeader>
              <CardTitle>Payroll Period Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Pay Period</p>
                  <p className="font-semibold">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Payment Due Date</p>
                  <p className="font-semibold">{dueDate.toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Payroll Status</p>
                  <p className="font-semibold">{payslip.payrollRun.status}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Payslip Status</p>
                  <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                    {payslip.status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Basic Salary
                </p>
                <p className="mt-1 text-2xl font-bold">₦{(payslip.basicSalary / 1000000).toFixed(2)}M</p>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Total Deductions
                </p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  -₦{(payslip.totalDeductions / 1000000).toFixed(2)}M
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Net Salary
                </p>
                <p className="mt-1 text-3xl font-bold text-green-600">
                  ₦{(payslip.netSalary / 1000000).toFixed(2)}M
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
