'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { ArrowUpRight, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

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

interface JobsResponse {
  data: Job[];
  meta?: {
    page: number;
    total: number;
    hasMore: boolean;
  };
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'OPEN') return 'success';
  if (status === 'ON_HOLD') return 'warning';
  if (status === 'CLOSED') return 'neutral';
  return 'info';
}

export default function JobsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['ui-recruitment-jobs', user?.id, user?.tenantId, page, status],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (status) {
        params.append('status', status);
      }

      return fetchDashboardApi<JobsResponse>(
        `/api/v1/recruitment/jobs?${params.toString()}`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
    },
  });

  const jobs = data?.data || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Job Openings"
        description="Manage requisitions and track hiring demand across departments."
        actions={
          <Link href="/recruitment/jobs/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Post Job
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={status === '' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
            >
              All Jobs
            </Button>
            {['OPEN', 'CLOSED', 'ON_HOLD'].map((nextStatus) => (
              <Button
                key={nextStatus}
                variant={status === nextStatus ? 'default' : 'outline'}
                onClick={() => {
                  setStatus(nextStatus);
                  setPage(1);
                }}
              >
                {nextStatus}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => {
              const closingDate = new Date(job.closingDate);
              const daysLeft = Math.ceil((closingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <Link href={`/recruitment/jobs/${job.id}`} className="text-sm font-medium text-foreground hover:underline">
                          {job.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">{job.department}</p>
                      </div>
                      <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-label">Level</p>
                        <p className="text-sm font-medium text-foreground">{job.jobLevel}</p>
                      </div>
                      <div>
                        <p className="text-label">Positions</p>
                        <p className="font-mono text-sm font-medium text-foreground tabular-nums">{job.numberOfPositions}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-label">Salary Range</p>
                      <p className="font-mono text-sm font-medium text-foreground tabular-nums">
                        ₦{(job.salaryMin / 1000000).toFixed(1)}M - ₦{(job.salaryMax / 1000000).toFixed(1)}M
                      </p>
                    </div>

                    <div className="border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <p className="font-mono text-sm font-medium tabular-nums">{job._count.applications}</p>
                          <p className="text-xs">applications</p>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            daysLeft > 7 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                          }`}
                        >
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
          <div className="rounded-md border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No job openings found</p>
          </div>
        )}

        {data?.meta ? (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {data.meta.page} of {Math.max(1, Math.ceil(data.meta.total / 20))}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={!data.meta.hasMore}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
