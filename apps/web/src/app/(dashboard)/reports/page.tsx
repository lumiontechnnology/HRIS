'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader } from '@/components/system/primitives';

interface ReportRow {
  id: string;
  reportName: string;
  owner: string;
  lastRun: string;
  status: 'Ready' | 'Queued';
}

const reportRows: ReportRow[] = [
  { id: 'RP-001', reportName: 'Monthly Headcount', owner: 'HR Ops', lastRun: '2026-03-15', status: 'Ready' },
  { id: 'RP-002', reportName: 'Payroll Variance', owner: 'Finance', lastRun: '2026-03-14', status: 'Ready' },
  { id: 'RP-003', reportName: 'Leave Utilization', owner: 'People Analytics', lastRun: '2026-03-12', status: 'Queued' },
];

export default function ReportsPage(): JSX.Element {
  const columns: ColumnDef<ReportRow>[] = [
    { key: 'reportName', label: 'Report', sortable: true },
    { key: 'owner', label: 'Owner', sortable: true },
    { key: 'lastRun', label: 'Last Run', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Reports" description="Build, run, and export operational and financial reports." />

      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>Select dataset, date range, and export format</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Select defaultValue="headcount">
            <SelectTrigger>
              <SelectValue placeholder="Dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="headcount">Headcount</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
              <SelectItem value="leave">Leave</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" />
          <Input type="date" />
          <div className="flex gap-2">
            <Button className="w-full">Generate</Button>
            <Button variant="outline" className="w-full">Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Results</CardTitle>
          <CardDescription>Filterable outputs with chart-ready summaries</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={reportRows}
            columns={columns}
            searchKeys={['reportName', 'owner', 'status']}
            searchPlaceholder="Search reports"
            emptyTitle="No reports"
            emptyDescription="Run report builder to generate entries."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chart Preview</CardTitle>
          <CardDescription>Headcount trend sample</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 rounded border border-slate-200 bg-slate-50 p-4">
            {[45, 48, 50, 53, 58, 61, 66, 70, 73, 78, 82, 85].map((value, index) => (
              <div key={value + index} className="flex items-end">
                <div className="w-full rounded-sm bg-slate-900" style={{ height: `${value}px` }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
