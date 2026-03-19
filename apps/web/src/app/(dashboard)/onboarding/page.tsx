'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { Badge, CardSkeleton, EmptyState, SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface NotificationResponse {
  data: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  }>;
}

interface HiredApplicationsResponse {
  data: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    updatedAt: string;
  }>;
}

interface TaskState {
  id: string;
  label: string;
  done: boolean;
}

const defaultTaskTemplate: TaskState[] = [
  { id: 'ACC', label: 'Create employee account', done: true },
  { id: 'MGR', label: 'Assign manager and department', done: true },
  { id: 'DOC', label: 'Upload employment documents', done: false },
  { id: 'PAY', label: 'Enroll payroll profile', done: false },
  { id: 'ORI', label: 'Complete orientation checklist', done: false },
];

export default function OnboardingPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['ui-onboarding', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    refetchInterval: 15000,
    queryFn: async () => {
      const [notifications, hiredApplications] = await Promise.all([
        fetchDashboardApi<NotificationResponse>(
          '/api/v1/notifications?limit=100',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
        fetchDashboardApi<HiredApplicationsResponse>(
          '/api/v1/recruitment/applications?status=HIRED&limit=50',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
      ]);

      return {
        onboardingNotifications: notifications.data.filter((n) => n.type === 'ONBOARDING_READY'),
        hires: hiredApplications.data,
      };
    },
  });

  const [tasks, setTasks] = useState(defaultTaskTemplate);
  const completed = tasks.filter((task) => task.done).length;
  const progress = Math.round((completed / tasks.length) * 100);

  const hires = data?.hires || [];
  const onboardingNotifications = data?.onboardingNotifications || [];

  const latestHires = useMemo(
    () =>
      [...hires]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .slice(0, 8),
    [hires]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Onboarding"
          description="Track new-hire setup and drive completion across all onboarding milestones."
        />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Onboarding"
        description="Track new-hire setup and drive completion across all onboarding milestones."
      />

      <Card>
        <CardHeader>
          <CardTitle>Progress Tracker</CardTitle>
          <CardDescription>{completed} of {tasks.length} tasks completed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-3 rounded bg-muted">
            <div className="h-3 rounded bg-foreground" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Current completion: {progress}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Hire Queue</CardTitle>
          <CardDescription>Automatically populated from recruitment hires</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {latestHires.length === 0 ? (
            <p className="text-sm text-muted-foreground">No newly hired candidates waiting for onboarding.</p>
          ) : (
            latestHires.map((hire) => (
              <div key={hire.id} className="rounded-md border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {hire.firstName} {hire.lastName}
                  </p>
                  <Badge tone="info">{hire.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{hire.email}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                  Hired on {new Date(hire.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Checklist</CardTitle>
          <CardDescription>Actionable setup list for HR and line managers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => (
            <button
              type="button"
              key={task.id}
              onClick={() => {
                setTasks((prev) =>
                  prev.map((item) => (item.id === task.id ? { ...item, done: !item.done } : item))
                );
              }}
              className="flex w-full items-center justify-between rounded-md border border-border px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/30"
            >
              <span className="text-sm text-foreground">{task.label}</span>
              <span
                className={`text-xs font-medium ${task.done ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'}`}
              >
                {task.done ? 'Done' : 'Pending'}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <EmptyState
        tone="friendly"
        title="Onboarding notifications live"
        description={
          onboardingNotifications.length > 0
            ? `${onboardingNotifications.length} onboarding alerts available for action.`
            : 'No onboarding alerts at the moment.'
        }
        action={<Button>Open New Hire Pack</Button>}
      />

      {onboardingNotifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding Alerts</CardTitle>
            <CardDescription>Real-time feed from notifications service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {onboardingNotifications.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
