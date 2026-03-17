'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { ArrowLeft, Users, Eye } from 'lucide-react';

interface Application {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  status: string;
  createdAt: string;
  interviews: Array<{
    id: string;
    round: string;
    status: string;
    rating?: number;
  }>;
}

interface Job {
  id: string;
  title: string;
  description: string;
  department: string;
  jobLevel: string;
  salaryMin: number;
  salaryMax: number;
  numberOfPositions: number;
  status: string;
  closingDate: string;
  createdAt: string;
  applications: Application[];
  _count: {
    applications: number;
  };
}

const statusColors = {
  SUBMITTED: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
  REVIEWING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  SHORTLISTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

const interviewRoundColors = {
  PHONE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  TECHNICAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  HR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  FINAL: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200',
};

export default function JobDetailPage(): JSX.Element {
  const params = useParams();
  const id = params.id as string;
  const { user } = useCurrentUser();
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/v1/recruitment/jobs/${id}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch job');
      }

      return res.json();
    },
    enabled: !!user && !!id,
  });

  const job: Job | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <Link href="/recruitment/jobs">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Job not found.
        </div>
      </div>
    );
  }

  const closingDate = new Date(job.closingDate);
  const daysLeft = Math.ceil(
    (closingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const filteredApplications = filterStatus
    ? job.applications.filter((app) => app.status === filterStatus)
    : job.applications;

  const applicationStats = {
    total: job.applications.length,
    submitted: job.applications.filter((a) => a.status === 'SUBMITTED').length,
    reviewing: job.applications.filter((a) => a.status === 'REVIEWING').length,
    shortlisted: job.applications.filter((a) => a.status === 'SHORTLISTED').length,
    rejected: job.applications.filter((a) => a.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/recruitment/jobs">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{job.title}</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{job.department}</p>
        </div>
        <span
          className={`inline-block rounded-full px-4 py-2 font-semibold ${
            job.status === 'OPEN'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200'
          }`}
        >
          {job.status}
        </span>
      </div>

      {/* Job Details Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Level</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{job.jobLevel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{job.numberOfPositions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Salary Range</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              ₦{(job.salaryMin / 1000000).toFixed(1)}M - ₦{(job.salaryMax / 1000000).toFixed(1)}M
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Closes In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${daysLeft > 7 ? 'text-green-600' : 'text-red-600'}`}>
              {daysLeft > 0 ? `${daysLeft}d` : 'Closed'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Description */}
      <Card>
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
            {job.description}
          </p>
        </CardContent>
      </Card>

      {/* Application Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Application Pipeline</CardTitle>
          <CardDescription>{applicationStats.total} total applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-400">Total</p>
              <p className="mt-1 text-2xl font-bold">{applicationStats.total}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-900/20">
              <p className="text-xs text-blue-600 dark:text-blue-400">Submitted</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">{applicationStats.submitted}</p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-900/20">
              <p className="text-xs text-indigo-600 dark:text-indigo-400">Reviewing</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{applicationStats.reviewing}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-900/20">
              <p className="text-xs text-green-600 dark:text-green-400">Shortlisted</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{applicationStats.shortlisted}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-red-600">{applicationStats.rejected}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Button
              variant={filterStatus === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('')}
            >
              All
            </Button>
            {['SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>

          {/* Applications List */}
          {filteredApplications.length > 0 ? (
            <div className="space-y-3">
              {filteredApplications.map((app) => (
                <div
                  key={app.id}
                  className="border border-slate-200 rounded-lg p-4 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{app.candidateName}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{app.candidateEmail}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{app.candidatePhone}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          statusColors[app.status as keyof typeof statusColors]
                        }`}
                      >
                        {app.status}
                      </span>
                      {app.interviews.length > 0 && (
                        <div className="flex gap-1 flex-wrap justify-end">
                          {app.interviews.map((interview) => (
                            <span
                              key={interview.id}
                              className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                                interviewRoundColors[interview.round as keyof typeof interviewRoundColors]
                              }`}
                            >
                              {interview.round}
                              {interview.rating && ` ${interview.rating}/10`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-600 dark:text-slate-400">No applications found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href={`/recruitment/applications?jobId=${job.id}`} className="flex-1">
          <Button variant="outline" className="w-full">
            <Users className="mr-2 h-4 w-4" />
            View All Applications
          </Button>
        </Link>
      </div>
    </div>
  );
}
