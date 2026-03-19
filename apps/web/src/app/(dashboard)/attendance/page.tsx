'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@lumion/ui';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

interface AttendanceRow {
  id: string;
  employee: string;
  date: string;
  clockIn: string;
  clockOut: string;
  status: 'Present' | 'Late' | 'On Leave' | 'Absent' | 'Early Departure';
}

interface AttendanceApiResponse {
  data: Array<{
    id: string;
    date: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    employee?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  }>;
}

function mapAttendanceStatus(value: string): AttendanceRow['status'] {
  if (value === 'LATE') return 'Late';
  if (value === 'ON_LEAVE') return 'On Leave';
  if (value === 'ABSENT') return 'Absent';
  if (value === 'EARLY_DEPARTURE') return 'Early Departure';
  return 'Present';
}

function formatTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export default function AttendancePage(): JSX.Element {
  const { user } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['ui-attendance', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const response = await fetchDashboardApi<AttendanceApiResponse>(
        '/api/v1/attendance?limit=100',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );

      const mapped: AttendanceRow[] = response.data.map((record) => ({
        id: record.id,
        employee:
          `${record.employee?.firstName ?? ''} ${record.employee?.lastName ?? ''}`.trim() ||
          'Unknown Employee',
        date: formatDate(record.date),
        clockIn: formatTime(record.clockIn),
        clockOut: formatTime(record.clockOut),
        status: mapAttendanceStatus(record.status),
      }));

      return mapped;
    },
  });

  const effectiveRows = data ?? [];

  const rows = useMemo(
    () => effectiveRows.filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter)),
    [effectiveRows, statusFilter]
  );

  const presentCount = effectiveRows.filter((row) => row.status === 'Present').length;
  const lateCount = effectiveRows.filter((row) => row.status === 'Late' || row.status === 'Early Departure').length;
  const onLeaveCount = effectiveRows.filter((row) => row.status === 'On Leave').length;

  const columns: ColumnDef<AttendanceRow>[] = [
    { key: 'employee', label: 'Employee', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'clockIn', label: 'Clock In', sortable: true },
    { key: 'clockOut', label: 'Clock Out', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge
          tone={
            row.status === 'Present'
              ? 'success'
              : row.status === 'Late' || row.status === 'Early Departure'
                ? 'warning'
                : row.status === 'Absent'
                  ? 'danger'
                  : 'info'
          }
        >
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Attendance" description="Monitor daily attendance and punctuality in real time." />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Present Today</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{presentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Late Arrivals</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{lateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>On Leave</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{onLeaveCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Register</CardTitle>
          <CardDescription>Sortable, searchable daily attendance log</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-[220px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Present">Present</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="Early Departure">Early Departure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              searchKeys={['employee', 'status', 'date']}
              searchPlaceholder="Search attendance records"
              emptyTitle="No attendance records"
              emptyDescription="No records found for selected filters."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
