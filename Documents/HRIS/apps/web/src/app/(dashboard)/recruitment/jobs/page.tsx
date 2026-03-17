'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { Plus, ArrowUpRight, Users } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  department: string;
  jobLevel: string;
  numberOfPositions: number;
  status: string;
  salaryMin: number;
  salaryMax: number;
  closingDate: string;
  _count: {
    applications: number;
  };
}

export default function JobsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (status) {
        params.append('status', status);
      }

      const res = await fetch(`http://localhost:3001/api/v1/recruitment/jobs?${params}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch jobs');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const jobs = data?.data || [];

  const statusColors = {
    OPEN: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    CLOSED: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
    ON_HOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Job Openings</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage job requisitions and openings.
          </p>
        </div>
        <Link href="/recruitment/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Post Job
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
              All Jobs
            </Button>
            {['OPEN', 'CLOSED', 'ON_HOLD'].map((s) => (
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

      {/* Jobs Grid */}
      <div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job: Job) => {
              const closingDate = new Date(job.closingDate);
              const daysLeft = Math.ceil(
                (closingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <Card key={job.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Link href={`/recruitment/jobs/${job.id}`}>
                          <h3 className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                            {job.title}
                          </h3>
                        </Link>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {job.department}
                        </p>
                      </div>
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${statusColors[job.status as keyof typeof statusColors]}`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Level</p>
                        <p className="font-semibold text-sm">{job.jobLevel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Positions</p>
                        <p className="font-semibold text-sm">{job.numberOfPositions}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Salary Range</p>
                      <p className="font-semibold text-sm">
                        ₦{(job.salaryMin / 1000000).toFixed(1)}M - ₦{(job.salaryMax / 1000000).toFixed(1)}M
                      </p>
                    </div>

                    <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          <p className="text-sm font-semibold">{job._count.applications}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">applications</p>
                        </div>
                        <span className={`text-xs font-semibold ${daysLeft > 7 ? 'text-green-600' : 'text-red-600'}`}>
                          {daysLeft > 0 ? `${daysLeft}d` : 'Closed'}
                        </span>
                      </div>
                    </div>

                    <Link href={`/recruitment/jobs/${job.id}`}>
                      <Button variant="outline" className="w-full">
                        View Details
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400">No job openings found</p>
          </div>
        )}

        {/* Pagination */}
        {data?.meta && (
          <div className="mt-6 flex items-center justify-between">
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
      </div>
    </div>
  );
}
