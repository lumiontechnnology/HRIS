'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

const stages: Array<'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired'> = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
];

interface RecruitmentSummaryResponse {
  data: {
    openPositions: number;
    totalApplications: number;
    shortlisted: number;
    rejected: number;
    scheduledInterviews: number;
    conversionRate: number;
  };
}

interface RecruitmentApplicationsResponse {
  data: Array<{
    id: string;
    firstName: string;
    lastName: string;
    status: string;
    currentScore?: number | null;
    currentStage?: string | null;
    jobRequisition?: {
      status?: string;
    } | null;
  }>;
}

interface PipelineCandidate {
  id: string;
  name: string;
  tags: string[];
  score: number;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
}

function mapApplicationStage(value: string): PipelineCandidate['stage'] {
  if (value === 'SCREENING') return 'Screening';
  if (value === 'PHONE_INTERVIEW' || value === 'TECHNICAL_TEST' || value === 'PANEL_INTERVIEW') {
    return 'Interview';
  }
  if (value === 'OFFER') return 'Offer';
  if (value === 'HIRED') return 'Hired';
  return 'Applied';
}

export default function RecruitmentPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ui-recruitment', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const [summaryResponse, applicationsResponse] = await Promise.all([
        fetchDashboardApi<RecruitmentSummaryResponse>(
          '/api/v1/recruitment/summary',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
        fetchDashboardApi<RecruitmentApplicationsResponse>(
          '/api/v1/recruitment/applications?limit=200',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
      ]);

      const pipeline: PipelineCandidate[] = applicationsResponse.data.map((application) => ({
        id: application.id,
        name: `${application.firstName} ${application.lastName}`.trim(),
        tags: [application.currentStage || application.status, application.jobRequisition?.status || 'Job Open'],
        score: application.currentScore ?? 0,
        stage: mapApplicationStage(application.status),
      }));

      return {
        summary: summaryResponse.data,
        pipeline,
      };
    },
  });

  const effectiveCandidates: PipelineCandidate[] = data?.pipeline ?? [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return effectiveCandidates;
    return effectiveCandidates.filter((candidate) => {
      return (
        candidate.name.toLowerCase().includes(normalized) ||
        candidate.tags.join(' ').toLowerCase().includes(normalized)
      );
    });
  }, [effectiveCandidates, query]);

  const summary = data?.summary;
  const openPositions = summary?.openPositions ?? 0;
  const totalApplications = summary?.totalApplications ?? effectiveCandidates.length;
  const scheduledInterviews = summary?.scheduledInterviews ?? filtered.filter((c) => c.stage === 'Interview').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Recruitment"
        description="Applicant tracking pipeline from application to hire."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Open Positions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{openPositions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Applications</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalApplications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scheduled Interviews</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{scheduledInterviews}</p>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-sm">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search candidates by name or tags"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {isLoading
          ? stages.map((stage) => (
              <div key={stage}>
                <CardSkeleton />
              </div>
            ))
          : stages.map((stage) => {
              const stageCandidates = filtered.filter((candidate) => candidate.stage === stage);

              return (
                <Card key={stage}>
                  <CardHeader>
                    <CardTitle className="text-base">{stage}</CardTitle>
                    <CardDescription>{stageCandidates.length} candidates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stageCandidates.length === 0 ? (
                      <div className="rounded border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                        No candidates in this stage.
                      </div>
                    ) : (
                      stageCandidates.map((candidate) => (
                        <div key={candidate.id} className="rounded border border-slate-200 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{candidate.name}</p>
                            <Badge tone={candidate.score >= 85 ? 'success' : 'info'}>Score {candidate.score}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {candidate.tags.map((tag) => (
                              <Badge key={tag} tone="neutral">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
