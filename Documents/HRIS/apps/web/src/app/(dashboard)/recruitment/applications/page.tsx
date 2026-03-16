'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { Eye, Mail, Phone } from 'lucide-react';

interface Application {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  status: string;
  createdAt: string;
  job: {
    id: string;
    title: string;
  };
  interviews: Array<{
    id: string;
    round: string;
    status: string;
  }>;
}

const statusColors = {
  SUBMITTED: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  REVIEWING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  SHORTLISTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

export default function ApplicationsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['applications', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (status) {
        params.append('status', status);
      }

      const res = await fetch(
        `http://localhost:3001/api/v1/recruitment/applications?${params}`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch applications');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const applications = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Applications</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Review and manage all job applications.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={status === '' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
            >
              All Applications
            </Button>
            {['SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED'].map((s) => (
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

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle>Candidate Pipeline</CardTitle>
          <CardDescription>All applications across all active jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-3">
              {applications.map((app: Application) => (
                <div
                  key={app.id}
                  className="border border-slate-200 rounded-lg p-4 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Candidate Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {app.candidateName}
                      </h3>
                      <Link
                        href={`/dashboard/recruitment/jobs/${app.job.id}`}
                        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {app.job.title}
                      </Link>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Mail className="h-4 w-4" />
                          <a href={`mailto:${app.candidateEmail}`} className="hover:underline">
                            {app.candidateEmail}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Phone className="h-4 w-4" />
                          <a href={`tel:${app.candidatePhone}`} className="hover:underline">
                            {app.candidatePhone}
                          </a>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex flex-col items-end gap-3">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                          statusColors[app.status as keyof typeof statusColors]
                        }`}
                      >
                        {app.status}
                      </span>

                      {/* Interview Badges */}
                      {app.interviews.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {app.interviews.map((interview) => (
                            <span
                              key={interview.id}
                              className="inline-block rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                            >
                              {interview.round}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* View Button */}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No applications found</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
