'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { Calendar, MapPin, User, Zap } from 'lucide-react';

interface Interview {
  id: string;
  round: string;
  scheduledDate: string;
  status: string;
  interviewerName: string;
  meetingLink?: string;
  rating?: number;
  application: {
    id: string;
    candidateName: string;
    candidateEmail: string;
    candidatePhone: string;
    job: {
      id: string;
      title: string;
    };
  };
}

const roundColors = {
  PHONE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200',
  TECHNICAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  HR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  FINAL: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200',
};

const statusColors = {
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  CANCELLED: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200',
};

export default function InterviewsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('SCHEDULED');

  const { data, isLoading } = useQuery({
    queryKey: ['interviews', page, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filterStatus) {
        params.append('status', filterStatus);
      }

      const res = await fetch(
        `http://localhost:3001/api/v1/recruitment/interviews?${params}`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch interviews');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const interviews = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Interviews</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Schedule and track candidate interviews.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={filterStatus === '' ? 'default' : 'outline'}
              onClick={() => {
                setFilterStatus('');
                setPage(1);
              }}
            >
              All Interviews
            </Button>
            {['SCHEDULED', 'COMPLETED', 'CANCELLED'].map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? 'default' : 'outline'}
                onClick={() => {
                  setFilterStatus(s);
                  setPage(1);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Interviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Schedule</CardTitle>
          <CardDescription>All scheduled and completed interviews</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : interviews.length > 0 ? (
            <div className="space-y-4">
              {interviews.map((interview: Interview) => {
                const interviewDate = new Date(interview.scheduledDate);
                const isUpcoming = interviewDate > new Date();

                return (
                  <div
                    key={interview.id}
                    className="border border-slate-200 rounded-lg p-4 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Interview Details */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {interview.application.candidateName}
                          </h3>
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                              roundColors[interview.round as keyof typeof roundColors]
                            }`}
                          >
                            {interview.round}
                          </span>
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                              statusColors[interview.status as keyof typeof statusColors]
                            }`}
                          >
                            {interview.status}
                          </span>
                        </div>

                        <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-3">
                          {interview.application.job.title}
                        </p>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {interviewDate.toLocaleDateString()} at{' '}
                              {interviewDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <User className="h-4 w-4" />
                            <span>{interview.interviewerName}</span>
                          </div>

                          {interview.meetingLink && (
                            <div className="flex items-center gap-2">
                              <a
                                href={interview.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                <MapPin className="inline h-4 w-4 mr-1" />
                                Join Meeting
                              </a>
                            </div>
                          )}

                          {interview.rating && (
                            <div className="flex items-center gap-2 text-sm">
                              <Zap className="h-4 w-4 text-yellow-500" />
                              <span className="text-slate-600 dark:text-slate-400">
                                Rating: {interview.rating}/10
                              </span>
                            </div>
                          )}

                          <div className="mt-2 text-sm">
                            <p className="text-slate-600 dark:text-slate-400">
                              <strong>Email:</strong> {interview.application.candidateEmail}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">
                              <strong>Phone:</strong> {interview.application.candidatePhone}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {interview.status === 'SCHEDULED' && isUpcoming && (
                          <>
                            {interview.meetingLink && (
                              <Button variant="default" size="sm">
                                Join Interview
                              </Button>
                            )}
                          </>
                        )}
                        <Button variant="outline" size="sm">
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No interviews found</p>
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
