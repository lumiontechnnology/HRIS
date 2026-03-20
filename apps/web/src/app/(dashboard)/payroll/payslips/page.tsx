'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { DollarSign, File } from 'lucide-react';

interface Payslip {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  basicSalary: number;
  earnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  payrollRun: {
    periodStart: string;
    periodEnd: string;
  };
}

export default function PayslipsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payslips', page],
    queryFn: async () => {
      const res = await fetch(
        `/api/proxy/payroll/payslips?page=${page}&limit=20`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch payslips');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const payslips = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Payslips</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            View and download employee payslips.
          </p>
        </div>
        <Link href="/payroll/runs">
          <Button variant="outline">
            <DollarSign className="mr-2 h-4 w-4" />
            Payroll Runs
          </Button>
        </Link>
      </div>

      {/* Payslips List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Payslips</CardTitle>
          <CardDescription>All employee payslips from all payroll runs</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : payslips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 text-left font-semibold">Employee</th>
                    <th className="pb-3 text-left font-semibold">Period</th>
                    <th className="pb-3 text-right font-semibold">Basic Salary</th>
                    <th className="pb-3 text-right font-semibold">Deductions</th>
                    <th className="pb-3 text-right font-semibold">Net Salary</th>
                    <th className="pb-3 text-left font-semibold">Status</th>
                    <th className="pb-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((slip: Payslip) => {
                    const startDate = new Date(slip.payrollRun.periodStart);
                    const endDate = new Date(slip.payrollRun.periodEnd);

                    return (
                      <tr
                        key={slip.id}
                        className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <td className="py-3">
                          <Link
                            href={`/payroll/payslips/${slip.id}`}
                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                          >
                            {slip.employee.firstName} {slip.employee.lastName}
                          </Link>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {slip.employee.employeeId}
                          </p>
                        </td>
                        <td className="py-3 text-sm">
                          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right font-medium">
                          ₦{(slip.basicSalary / 1000000).toFixed(2)}M
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
                        <td className="py-3">
                          <Link href={`/payroll/payslips/${slip.id}`}>
                            <Button variant="ghost" size="sm">
                              <File className="h-4 w-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No payslips found</p>
            </div>
          )}

          {/* Pagination */}
          {data?.meta && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Page {data.meta.page} of {Math.ceil(data.meta.total / 20)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.meta.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
