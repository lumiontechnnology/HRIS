'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { Briefcase, Users, CheckCircle, XCircle, Calendar } from 'lucide-react';

export default function RecruitmentPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data } = useQuery({
    queryKey: ['recruitment-summary'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/v1/recruitment/summary', {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Recruitment</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage job openings, applications, and interviews.
          </p>
        </div>
        <Link href="/dashboard/recruitment/jobs/new">
          <Button>
            <Briefcase className="mr-2 h-4 w-4" />
            Post Job
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4" />
              Open Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.openPositions || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">active jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalApplications || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">total received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4" />
              Shortlisted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.shortlisted || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">moving forward</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4" />
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.rejected || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">not selected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.scheduledInterviews || 0}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Recruitment Metrics</CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <p className="font-semibold">Conversion Rate</p>
                <p className="text-2xl font-bold">{summary.conversionRate}%</p>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full dark:bg-slate-800">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${summary.conversionRate}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {summary.shortlisted} of {summary.totalApplications} applications shortlisted
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Job Openings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Create and manage active job requisitions.
            </p>
            <Link href="/dashboard/recruitment/jobs">
              <Button variant="outline" className="w-full">
                View All Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Review and manage candidate applications.
            </p>
            <Link href="/dashboard/recruitment/applications">
              <Button variant="outline" className="w-full">
                View Pipeline
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Schedule and track interview sessions.
            </p>
            <Link href="/dashboard/recruitment/interviews">
              <Button variant="outline" className="w-full">
                View Schedule
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
