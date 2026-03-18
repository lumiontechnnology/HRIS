'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader, Badge } from '@/components/system/primitives';

interface GoalRow {
  id: string;
  employee: string;
  goal: string;
  progress: number;
  workflow: 'Self Appraisal' | 'Manager Review' | 'Calibration' | 'Finalized';
}

const goalRows: GoalRow[] = [
  { id: 'PF-001', employee: 'Chioma Adeyemi', goal: 'Reduce API response latency by 20%', progress: 78, workflow: 'Manager Review' },
  { id: 'PF-002', employee: 'Tunde Okafor', goal: 'Ship payroll export automation', progress: 65, workflow: 'Self Appraisal' },
  { id: 'PF-003', employee: 'Blessing Okafor', goal: 'Improve onboarding completion to 95%', progress: 91, workflow: 'Calibration' },
];

export default function PerformancePage(): JSX.Element {
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
      render: (row) => <Badge tone={row.workflow === 'Finalized' ? 'success' : 'info'}>{row.workflow}</Badge>,
    },
  ];

  const distribution = [
    { label: 'High', value: 18 },
    { label: 'Solid', value: 72 },
    { label: 'Needs Support', value: 10 },
  ];

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
