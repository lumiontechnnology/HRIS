'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { Activity, Coins, UserCheck, Users } from 'lucide-react';
import { KpiCard, SectionHeader, Badge } from '@/components/system/primitives';

const headcountTrend = [112, 114, 117, 120, 122, 124, 126, 129, 132, 134, 136, 138];

const departmentDistribution = [
  { name: 'Engineering', count: 48 },
  { name: 'Sales', count: 26 },
  { name: 'HR', count: 14 },
  { name: 'Finance', count: 12 },
  { name: 'Operations', count: 18 },
];

const pendingApprovals = [
  { id: 'APR-1001', type: 'Leave Request', owner: 'Amara Ngoako', age: '2h' },
  { id: 'APR-1002', type: 'Payroll Override', owner: 'David Peter', age: '5h' },
  { id: 'APR-1003', type: 'New Position', owner: 'Blessing Okafor', age: '1d' },
];

const notifications = [
  'Payroll run is due for review by 3:00 PM.',
  '5 new candidates moved to interview stage.',
  'Onboarding tasks pending for 3 new hires.',
];

const activityLog = [
  { actor: 'Chioma Adeyemi', action: 'approved leave request', time: '08:45' },
  { actor: 'Finance Bot', action: 'generated payroll draft', time: '08:32' },
  { actor: 'Recruitment Team', action: 'published Backend Engineer role', time: '08:18' },
  { actor: 'HR Admin', action: 'updated compensation band', time: '07:57' },
];

export default function DashboardPage(): JSX.Element {
  const maxHeadcount = Math.max(...headcountTrend);
  const maxDept = Math.max(...departmentDistribution.map((item) => item.count));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard"
        description="Operational snapshot across workforce, payroll, approvals, and hiring."
        actions={<Button>Export Snapshot</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Employees" value="138" hint="+4 this month" icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Active Employees" value="131" hint="94.9% active" icon={<UserCheck className="h-4 w-4" />} />
        <KpiCard label="Monthly Payroll Cost" value="NGN 329.4M" hint="Current draft cycle" icon={<Coins className="h-4 w-4" />} />
        <KpiCard label="Attrition Rate" value="2.4%" hint="Rolling 12 months" icon={<Activity className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Headcount Trend</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-4">
              {headcountTrend.map((value, index) => (
                <div key={value + index} className="flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-sm bg-slate-900"
                    style={{ height: `${Math.max(12, (value / maxHeadcount) * 130)}px` }}
                  />
                  <span className="text-[10px] text-slate-500">M{index + 1}</span>
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
                  <span className="text-slate-700">{dept.name}</span>
                  <span className="font-semibold text-slate-900">{dept.count}</span>
                </div>
                <div className="h-2 rounded bg-slate-200">
                  <div
                    className="h-2 rounded bg-slate-800"
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
              <div key={item.id} className="rounded border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{item.type}</span>
                  <Badge tone="warning">{item.age}</Badge>
                </div>
                <p className="text-sm text-slate-600">{item.owner}</p>
                <p className="mt-1 text-xs text-slate-500">{item.id}</p>
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
              <div key={note} className="rounded border border-slate-200 p-3 text-sm text-slate-700">
                {note}
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
              <div key={`${item.actor}-${item.time}`} className="rounded border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{item.actor}</p>
                <p className="text-sm text-slate-600">{item.action}</p>
                <p className="mt-1 text-xs text-slate-500">{item.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
