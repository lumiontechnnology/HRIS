'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader, Badge, CardSkeleton } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface GoalRow {
  id: string;
  employee: string;
  goal: string;
  progress: number;
  workflow: 'ACTIVE' | 'ON_TRACK' | 'COMPLETED' | 'MISSED';
}

interface PerformanceGoalsResponse {
  data: Array<{
    id: string;
    title: string;
    targetValue?: string | null;
    currentValue?: string | null;
    status: GoalRow['workflow'];
    employee: {
      firstName: string;
      lastName: string;
    };
  }>;
}

interface PerformanceSummaryResponse {
  data: {
    distribution: Array<{ label: string; value: number }>;
  };
}

function parseProgress(current?: string | null, target?: string | null): number {
  const currentNumber = Number(current);
  const targetNumber = Number(target);

  if (Number.isFinite(currentNumber) && Number.isFinite(targetNumber) && targetNumber > 0) {
    return Math.max(0, Math.min(100, Math.round((currentNumber / targetNumber) * 100)));
  }

  return 0;
}

export default function PerformancePage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['ui-performance', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const [goalsResponse, summaryResponse] = await Promise.all([
        fetchDashboardApi<PerformanceGoalsResponse>(
          '/api/v1/performance/goals?limit=200',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
        fetchDashboardApi<PerformanceSummaryResponse>(
          '/api/v1/performance/summary',
          user ? { id: user.id, tenantId: user.tenantId } : undefined
        ),
      ]);

      const goals: GoalRow[] = goalsResponse.data.map((goal) => ({
        id: goal.id,
        employee: `${goal.employee.firstName} ${goal.employee.lastName}`.trim(),
        goal: goal.title,
        progress: parseProgress(goal.currentValue, goal.targetValue),
        workflow: goal.status,
      }));

      return {
        goals,
        distribution: summaryResponse.data.distribution,
      };
    },
  });

  const goalRows = data?.goals || [];

  const columns: ColumnDef<GoalRow>[] = [
    { key: 'employee', label: 'Employee', sortable: true },
    { key: 'goal', label: 'Goal', sortable: true },
    {
      key: 'progress',
      label: 'Progress',
      sortable: true,
      render: (row) => `${row.progress}%`,
    },
    {
      key: 'workflow',
      label: 'Review Workflow',
      sortable: true,
      render: (row) => (
        <Badge tone={row.workflow === 'COMPLETED' ? 'success' : row.workflow === 'MISSED' ? 'danger' : 'info'}>
          {row.workflow}
        </Badge>
      ),
    },
  ];

  const distribution = data?.distribution || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Performance"
          description="Track goals, review stages, and organizational performance distribution."
        />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Performance"
        description="Track goals, review stages, and organizational performance distribution."
      />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Goals Dashboard</CardTitle>
            <CardDescription>Sortable goals and review workflow tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={goalRows}
              columns={columns}
              searchKeys={['employee', 'goal', 'workflow']}
              searchPlaceholder="Search goals and owners"
              emptyTitle="No goals found"
              emptyDescription="Create quarterly goals to begin performance tracking."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution</CardTitle>
            <CardDescription>Current cycle spread</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {distribution.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <div className="h-2 rounded bg-slate-200">
                  <div className="h-2 rounded bg-slate-900" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
