'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_DEPARTURE' | 'ON_LEAVE';
  hoursWorked?: number;
}

const statusColors = {
  PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  EARLY_DEPARTURE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
  ON_LEAVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
};

export default function AttendanceHistoryPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Find current employee
  const { data: employeeData } = useQuery({
    queryKey: ['current-employee'],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3001/api/v1/employees?limit=1`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch employee');
      }

      const data = await res.json();
      return data.data?.[0];
    },
    enabled: !!user,
  });

  // Fetch attendance history
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-history', employeeData?.id, month, page],
    queryFn: async () => {
      if (!employeeData?.id) return null;

      const res = await fetch(
        `http://localhost:3001/api/v1/attendance/employee/${employeeData.id}?month=${month}&page=${page}&limit=20`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch attendance');
      }

      return res.json();
    },
    enabled: !!user && !!employeeData?.id,
  });

  const records = data?.data || [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/attendance">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Attendance History</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            View your attendance records by month.
          </p>
        </div>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label htmlFor="month" className="block text-sm font-medium mb-2">
                Select Month
              </label>
              <Input
                id="month"
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{summary.present}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Late</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{summary.late}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{summary.absent}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">On Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{summary.onLeave}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
          <CardDescription>Daily attendance with clock times</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 text-left font-semibold">Date</th>
                    <th className="pb-3 text-left font-semibold">Clock In</th>
                    <th className="pb-3 text-left font-semibold">Clock Out</th>
                    <th className="pb-3 text-left font-semibold">Hours</th>
                    <th className="pb-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record: AttendanceRecord) => {
                    const date = new Date(record.date);
                    const clockInTime = new Date(record.clockInTime);
                    const clockOutTime = record.clockOutTime ? new Date(record.clockOutTime) : null;

                    return (
                      <tr
                        key={record.id}
                        className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <td className="py-3">{date.toLocaleDateString()}</td>
                        <td className="py-3">
                          {clockInTime.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3">
                          {clockOutTime
                            ? clockOutTime.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="py-3">
                          {record.hoursWorked ? record.hoursWorked.toFixed(1) : '—'} h
                        </td>
                        <td className="py-3">
                          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColors[record.status]}`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No records found for this month</p>
            </div>
          )}

          {/* Pagination */}
          {data?.meta && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Page {data.meta.page} of {Math.ceil(data.meta.total / 20)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.meta.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
