'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { Calendar, MapPin, User, Zap } from 'lucide-react';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

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

interface InterviewResponse {
  data: Interview[];
  meta?: {
    page: number;
    total: number;
    hasMore: boolean;
  };
}

function toTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'SCHEDULED') return 'info';
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function toRoundTone(round: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (round === 'TECHNICAL' || round === 'FINAL') return 'info';
  if (round === 'HR') return 'warning';
  if (round === 'PHONE') return 'neutral';
  return 'neutral';
}

export default function InterviewsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('SCHEDULED');

  const { data, isLoading } = useQuery({
    queryKey: ['ui-recruitment-interviews', user?.id, user?.tenantId, page, filterStatus],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filterStatus) {
        params.append('status', filterStatus);
      }

      return fetchDashboardApi<InterviewResponse>(
        `/api/v1/recruitment/interviews?${params.toString()}`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
    },
  });

  const interviews = data?.data || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Interviews"
        description="Schedule and track candidate interviews across all hiring rounds."
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterStatus === '' ? 'default' : 'outline'}
              onClick={() => {
                setFilterStatus('');
                setPage(1);
              }}
            >
              All Interviews
            </Button>
            {['SCHEDULED', 'COMPLETED', 'CANCELLED'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                onClick={() => {
                  setFilterStatus(status);
                  setPage(1);
                }}
              >
                {status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interview Schedule</CardTitle>
          <CardDescription>Upcoming and completed sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : interviews.length > 0 ? (
            <div className="space-y-4">
              {interviews.map((interview) => {
                const interviewDate = new Date(interview.scheduledDate);
                const isUpcoming = interviewDate > new Date();

                return (
                  <div
                    key={interview.id}
                    className="rounded-md border border-border p-4 transition-colors duration-150 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="font-medium text-foreground">{interview.application.candidateName}</h3>
                          <Badge tone={toRoundTone(interview.round)}>{interview.round}</Badge>
                          <Badge tone={toTone(interview.status)}>{interview.status}</Badge>
                        </div>

                        <p className="mb-3 text-sm text-muted-foreground">{interview.application.job.title}</p>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {interviewDate.toLocaleDateString()} at{' '}
                              {interviewDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{interview.interviewerName}</span>
                          </div>

                          {interview.meetingLink ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <a
                                href={interview.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors duration-150 hover:text-foreground"
                              >
                                Join Meeting
                              </a>
                            </div>
                          ) : null}

                          {interview.rating ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Zap className="h-4 w-4" />
                              <span className="font-mono tabular-nums">Rating: {interview.rating}/10</span>
                            </div>
                          ) : null}

                          <div className="mt-2 text-sm text-muted-foreground">
                            <p>
                              <strong className="text-foreground">Email:</strong> {interview.application.candidateEmail}
                            </p>
                            <p>
                              <strong className="text-foreground">Phone:</strong> {interview.application.candidatePhone}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {interview.status === 'SCHEDULED' && isUpcoming && interview.meetingLink ? (
                          <Button variant="default" size="sm">
                            Join Interview
                          </Button>
                        ) : null}
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
            <p className="py-8 text-center text-sm text-muted-foreground">No interviews found</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
