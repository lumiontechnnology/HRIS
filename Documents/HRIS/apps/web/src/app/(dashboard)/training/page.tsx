'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader, CardSkeleton } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface TrainingRow {
  id: string;
  title: string;
  provider: string;
  type: string;
  status: string;
}

interface TrainingEnrollmentResponse {
  data: Array<{
    id: string;
    status: string;
    training: {
      title: string;
      provider?: string | null;
      type: string;
    };
  }>;
}

export default function TrainingPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ['ui-training', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () =>
      fetchDashboardApi<TrainingEnrollmentResponse>(
        '/api/v1/training/enrollments?limit=200',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      ),
  });

  const rows: TrainingRow[] = (data?.data || []).map((record) => ({
    id: record.id,
    title: record.training.title,
    provider: record.training.provider || 'Internal Program',
    type: record.training.type,
    status: record.status,
  }));

  const columns: ColumnDef<TrainingRow>[] = [
    { key: 'title', label: 'Training', sortable: true },
    { key: 'provider', label: 'Provider', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Training" description="Track development plans and enrollment outcomes." />
        <CardSkeleton />
      </div>
    );
  }

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
