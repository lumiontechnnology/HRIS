'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { Plus, ArrowUpRight } from 'lucide-react';

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: 'DRAFT' | 'GENERATED' | 'APPROVED' | 'PROCESSING' | 'PAID';
  totalAmount?: number;
  paySchedule: {
    name: string;
    frequency: string;
  };
}

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  GENERATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
};

export default function PayrollRunsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (status) {
        params.append('status', status);
      }

      const res = await fetch(`http://localhost:3001/api/v1/payroll/runs?${params}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch payroll runs');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const runs = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Payroll Runs</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage all payroll runs and salary cycles.
          </p>
        </div>
        <Link href="/payroll/runs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Run
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={status === '' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
            >
              All Runs
            </Button>
            {['DRAFT', 'GENERATED', 'APPROVED', 'PROCESSING', 'PAID'].map((s) => (
              <Button
                key={s}
                variant={status === s ? 'default' : 'outline'}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
          <CardDescription>All salary runs with processing status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : runs.length > 0 ? (
            <div className="space-y-4">
              {runs.map((run: PayrollRun) => {
                const startDate = new Date(run.periodStart);
                const endDate = new Date(run.periodEnd);
                const dueDate = new Date(run.dueDate);

                return (
                  <div
                    key={run.id}
                    className="border border-slate-200 rounded-lg p-4 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {run.paySchedule.name}
                          </h3>
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[run.status]}`}
                          >
                            {run.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </p>
                        <div className="mt-2 flex gap-6 text-sm">
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Schedule</p>
                            <p className="font-medium">{run.paySchedule.frequency}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 dark:text-slate-400">Due Date</p>
                            <p className="font-medium">{dueDate.toLocaleDateString()}</p>
                          </div>
                          {run.totalAmount && (
                            <div>
                              <p className="text-slate-600 dark:text-slate-400">Total Amount</p>
                              <p className="font-medium">₦{(run.totalAmount / 1000000).toFixed(1)}M</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <Link href={`/payroll/runs/${run.id}`}>
                        <Button variant="ghost" size="sm">
                          <ArrowUpRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No payroll runs found</p>
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
