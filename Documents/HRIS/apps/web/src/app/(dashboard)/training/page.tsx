'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { SectionHeader, CardSkeleton, Badge, KpiCard } from '@/components/system/primitives';
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

function getTrainingTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const normalized = status.toUpperCase();

  if (normalized.includes('COMPLETE') || normalized.includes('PASSED')) return 'success';
  if (normalized.includes('IN_PROGRESS') || normalized.includes('ONGOING')) return 'info';
  if (normalized.includes('DUE') || normalized.includes('PENDING')) return 'warning';
  if (normalized.includes('FAILED') || normalized.includes('OVERDUE')) return 'danger';

  return 'neutral';
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
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge tone={getTrainingTone(row.status)}>{row.status}</Badge>,
    },
  ];

  const completedCount = rows.filter((row) => row.status.toUpperCase().includes('COMPLETE')).length;
  const inProgressCount = rows.filter((row) => row.status.toUpperCase().includes('PROGRESS')).length;

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

      <div className="grid gap-5 md:grid-cols-3">
        <KpiCard label="Total Enrollments" value={String(rows.length)} hint="Current learning activity" />
        <KpiCard label="Completed" value={String(completedCount)} hint="Marked complete" />
        <KpiCard label="In Progress" value={String(inProgressCount)} hint="Actively underway" />
      </div>

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
