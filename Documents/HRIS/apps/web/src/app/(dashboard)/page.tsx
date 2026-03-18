'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { KpiCard, SectionHeader, Badge, CardSkeleton } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

interface DashboardSummaryResponse {
  data: {
    kpis: {
      totalEmployees: number;
      activeEmployees: number;
      monthlyPayrollCost: number;
      attritionRate: number;
    };
    headcountTrend: Array<{ label: string; value: number }>;
    departmentDistribution: Array<{ name: string; count: number }>;
    pendingApprovals: Array<{ id: string; type: string; owner: string; age: string }>;
    notifications: Array<{ id: string; title: string; message: string; read: boolean }>;
    activityLog: Array<{ id: string; actor: string; action: string; time: string }>;
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage(): JSX.Element {
  const { user } = useCurrentUser();
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ['ui-dashboard', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    refetchInterval: 15000,
    queryFn: async () =>
      fetchDashboardApi<DashboardSummaryResponse>(
        '/api/v1/dashboard/summary',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      ),
  });

  const summary = data?.data;

  const headcountTrend = summary?.headcountTrend || [];
  const departmentDistribution = summary?.departmentDistribution || [];
  const pendingApprovals = summary?.pendingApprovals || [];
  const notifications = summary?.notifications || [];
  const activityLog = summary?.activityLog || [];

  const maxHeadcount = Math.max(...headcountTrend.map((item) => item.value), 1);
  const maxDept = Math.max(...departmentDistribution.map((item) => item.count), 1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Dashboard"
          description="Operational snapshot across workforce, payroll, approvals, and hiring."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const totalEmployees = summary?.kpis.totalEmployees || 0;
  const activeEmployees = summary?.kpis.activeEmployees || 0;
  const monthlyPayrollCost = summary?.kpis.monthlyPayrollCost || 0;
  const attritionRate = summary?.kpis.attritionRate || 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Good morning${user?.firstName ? `, ${user.firstName}` : ''}.`}
        description={`Here's what's happening at Lumion today. ${monthLabel}`}
        actions={<Button variant="outline">Export snapshot</Button>}
      />

      <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Total Employees" value={String(totalEmployees)} hint="Current workforce" />
        <KpiCard label="Active Employees" value={String(activeEmployees)} hint={totalEmployees > 0 ? `${((activeEmployees / totalEmployees) * 100).toFixed(1)}% active` : 'No active employees'} />
        <KpiCard label="Monthly Payroll" value={formatMoney(monthlyPayrollCost)} hint="Latest payroll run" />
        <KpiCard label="Attrition Rate" value={`${attritionRate}%`} hint="Rolling 12 months" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Headcount Trend</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-card p-4">
              {headcountTrend.map((point) => (
                <div key={point.label} className="flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-sm bg-foreground"
                    style={{ height: `${Math.max(12, (point.value / maxHeadcount) * 130)}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Current active population</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {departmentDistribution.map((dept) => (
              <div key={dept.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-foreground">{dept.name}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">{dept.count}</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-foreground"
                    style={{ width: `${(dept.count / maxDept) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>Queue requiring action</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.type}</span>
                  <Badge tone="warning">{item.age}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.owner}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{item.id}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications Feed</CardTitle>
            <CardDescription>Latest platform updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((note) => (
              <div key={note.id} className="rounded-md border border-border p-4 text-sm text-foreground">
                <p className="font-medium text-foreground">{note.title}</p>
                <p className="mt-1">{note.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity Log</CardTitle>
            <CardDescription>Auditable timeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLog.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-4">
                <p className="text-sm font-medium text-foreground">{item.actor}</p>
                <p className="text-sm text-muted-foreground">{item.action}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{new Date(item.time).toLocaleTimeString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
