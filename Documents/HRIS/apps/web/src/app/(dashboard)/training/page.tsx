'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader } from '@/components/system/primitives';

interface TrainingRow {
  id: string;
  title: string;
  provider: string;
  type: string;
  status: string;
}

const rows: TrainingRow[] = [
  { id: 'TR-001', title: 'Leadership Essentials', provider: 'Lumion Academy', type: 'Internal', status: 'Enrolled' },
  { id: 'TR-002', title: 'Advanced Payroll Compliance', provider: 'Finance Guild', type: 'External', status: 'In Progress' },
  { id: 'TR-003', title: 'Secure Coding Standards', provider: 'Engineering Guild', type: 'Internal', status: 'Completed' },
];

export default function TrainingPage(): JSX.Element {
  const columns: ColumnDef<TrainingRow>[] = [
    { key: 'title', label: 'Training', sortable: true },
    { key: 'provider', label: 'Provider', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Training" description="Track development plans and enrollment outcomes." />

      <Card>
        <CardHeader>
          <CardTitle>Training Catalog</CardTitle>
          <CardDescription>Searchable and sortable employee learning records</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows}
            columns={columns}
            searchKeys={['title', 'provider', 'type', 'status']}
            searchPlaceholder="Search training records"
            emptyTitle="No training records"
            emptyDescription="Create learning plans to populate this view."
          />
        </CardContent>
      </Card>
    </div>
  );
}
