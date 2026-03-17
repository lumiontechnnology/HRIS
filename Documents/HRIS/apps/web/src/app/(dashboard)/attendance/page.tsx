'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, useToast } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { Clock, LogIn, LogOut, Calendar } from 'lucide-react';
import Link from 'next/link';

interface AttendanceRecord {
  id: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_DEPARTURE' | 'ON_LEAVE';
  hoursWorked?: number;
}

export default function AttendancePage(): JSX.Element {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

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
      const emp = data.data?.[0];
      if (emp) setSelectedEmployeeId(emp.id);
      return emp;
    },
    enabled: !!user,
  });

  // Fetch today's attendance
  const { data: todayData, refetch } = useQuery({
    queryKey: ['today-attendance', selectedEmployeeId],
    queryFn: async () => {
      if (!selectedEmployeeId) return null;

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const res = await fetch(
        `http://localhost:3001/api/v1/attendance?employeeId=${selectedEmployeeId}&startDate=${dateStr}&endDate=${dateStr}`,
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
    enabled: !!user && !!selectedEmployeeId,
  });

  const todayRecord = todayData?.data?.[0] as AttendanceRecord | undefined;

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('http://localhost:3001/api/v1/attendance/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to clock in');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Clocked in successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clock in',
        variant: 'destructive',
      });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('http://localhost:3001/api/v1/attendance/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to clock out');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Clocked out successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clock out',
        variant: 'destructive',
      });
    },
  });

  const statusColors = {
    PRESENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    LATE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    ABSENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    EARLY_DEPARTURE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
    ON_LEAVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Attendance</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Clock in/out and track your attendance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/attendance/history">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              History
            </Button>
          </Link>
          <Link href="/attendance/reports">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Today's Status */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Status</CardTitle>
          <CardDescription>{new Date().toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent>
          {todayRecord ? (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Status</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 font-semibold ${statusColors[todayRecord.status]}`}
                  >
                    {todayRecord.status}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Hours Worked
                  </p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {todayRecord.hoursWorked ? todayRecord.hoursWorked.toFixed(1) : '—'}
                  </p>
                </div>
              </div>

              {/* Clock Times */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Clock In</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {new Date(todayRecord.clockInTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {todayRecord.clockOutTime ? (
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <LogOut className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Clock Out</span>
                    </div>
                    <p className="mt-2 text-2xl font-bold">
                      {new Date(todayRecord.clockOutTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed border-slate-300 p-4 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <LogOut className="h-5 w-5 text-slate-400" />
                      <span className="font-medium text-slate-500">Not Clocked Out</span>
                    </div>
                    <p className="mt-2 text-slate-400">Waiting for clock out...</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!todayRecord.clockOutTime && (
                <Button
                  onClick={() => clockOutMutation.mutate()}
                  disabled={clockOutMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  {clockOutMutation.isPending ? 'Clocking Out...' : 'Clock Out Now'}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400">You haven't clocked in yet.</p>
              <Button
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
                className="w-full"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                {clockInMutation.isPending ? 'Clocking In...' : 'Clock In Now'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">38.5h</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">hours worked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">21/21</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">days present</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">100%</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">on track</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
