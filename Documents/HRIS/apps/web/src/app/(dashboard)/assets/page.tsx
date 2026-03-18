'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader } from '@/components/system/primitives';

interface AssetRow {
  id: string;
  asset: string;
  serial: string;
  assignee: string;
  status: string;
}

const rows: AssetRow[] = [
  { id: 'AS-001', asset: 'MacBook Pro 16', serial: 'LUM-001-MBP', assignee: 'Chioma Adeyemi', status: 'Assigned' },
  { id: 'AS-002', asset: 'Dell Latitude', serial: 'LUM-002-DEL', assignee: 'Tunde Okafor', status: 'Assigned' },
  { id: 'AS-003', asset: 'Logitech Dock', serial: 'LUM-003-DCK', assignee: 'Inventory', status: 'Available' },
];

export default function AssetsPage(): JSX.Element {
  const columns: ColumnDef<AssetRow>[] = [
    { key: 'asset', label: 'Asset', sortable: true },
    { key: 'serial', label: 'Serial', sortable: true },
    { key: 'assignee', label: 'Assignee', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Assets" description="Govern employee asset assignments and inventory lifecycle." />

      <Card>
        <CardHeader>
          <CardTitle>Asset Register</CardTitle>
          <CardDescription>Filterable and paginated inventory list</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows}
            columns={columns}
            searchKeys={['asset', 'serial', 'assignee', 'status']}
            searchPlaceholder="Search assets"
            emptyTitle="No assets"
            emptyDescription="Add assets to begin inventory tracking."
          />
        </CardContent>
      </Card>
    </div>
  );
}
