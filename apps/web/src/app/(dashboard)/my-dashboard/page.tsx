'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { ClockWidget } from '@/components/attendance/clock-widget';

interface MeDashboardResponse {
  data: {
    profile: {
      name: string;
      role: string;
      department: string;
      manager: string | null;
      avatar?: string | null;
      employeeId: string;
      hireDate: string;
    };
    leaveBalance: { annual: number; sick: number; carried_over: number };
    recentPayslips: Array<{ id: string; period: string; amount: number; url: string }>;
    leaveRequests: { approved: number; pending: number; rejected: number };
    tasks: { total: number; completed: number };
    announcements: Array<{ id: string; title: string; content: string }>;
  };
}

export default function MyDashboardPage(): JSX.Element {
  const { user } = useCurrentUser();
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['me-dashboard', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () => fetchDashboardApi<MeDashboardResponse>('/api/v1/me/dashboard', user ? { id: user.id, tenantId: user.tenantId } : undefined),
  });

  const dashboard = data?.data;
  const firstName = useMemo(() => (dashboard?.profile.name || user?.firstName || 'there').split(' ')[0], [dashboard?.profile.name, user?.firstName]);
  const progress = dashboard?.tasks.total ? Math.round((dashboard.tasks.completed / dashboard.tasks.total) * 100) : 0;

  if (isLoading || !dashboard) {
    return <div className="text-sm text-muted-foreground">Loading your workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">Good morning, {firstName}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      <ClockWidget />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Annual leave balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl tabular-nums">{dashboard.leaveBalance.annual} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sick leave balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl tabular-nums">{dashboard.leaveBalance.sick} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pending requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl tabular-nums">{dashboard.leaveRequests.pending}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My Recent Payslips</CardTitle>
            <CardDescription>Latest 3 payroll periods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentPayslips.map((slip) => (
              <div key={slip.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{slip.period}</p>
                  <p className="font-mono text-xs text-muted-foreground">NGN {slip.amount.toLocaleString('en-NG')}</p>
                </div>
                <a href={slip.url} target="_blank" rel="noreferrer" className="text-sm text-foreground underline-offset-2 hover:underline">
                  Download PDF
                </a>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Leave Status</CardTitle>
            <CardDescription>Current request outcomes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center justify-between"><span className="text-muted-foreground">Approved</span><span className="font-mono tabular-nums">{dashboard.leaveRequests.approved}</span></p>
            <p className="flex items-center justify-between"><span className="text-muted-foreground">Pending</span><span className="font-mono tabular-nums">{dashboard.leaveRequests.pending}</span></p>
            <p className="flex items-center justify-between"><span className="text-muted-foreground">Rejected</span><span className="font-mono tabular-nums">{dashboard.leaveRequests.rejected}</span></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Tasks / Onboarding Checklist</CardTitle>
          <CardDescription>
            {dashboard.tasks.completed} of {dashboard.tasks.total} complete
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full rounded bg-muted">
            <div className="h-2 rounded bg-foreground" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{progress}% complete</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.announcements.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.content}</p>
            </div>
          ))}
          {dashboard.announcements.length === 0 && (
            <div className="text-sm text-muted-foreground">No announcements yet.</div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <a href="/my-payslips">View all payslips</a>
        </Button>
      </div>
    </div>
  );
}
