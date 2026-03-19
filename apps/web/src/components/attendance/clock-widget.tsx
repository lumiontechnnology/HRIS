'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

type TodayAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'WEEKEND'
  | null;

interface TodayAttendancePayload {
  data: {
    date: string;
    status: TodayAttendanceStatus;
    clockIn: string | null;
    clockOut: string | null;
    workedHours: number | null;
    canClockIn: boolean;
    canClockOut: boolean;
  };
}

function formatTime(value: string | null): string {
  if (!value) return '--';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(clockIn: string | null): string {
  if (!clockIn) return '0h 0m';
  const diff = Date.now() - new Date(clockIn).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function formatWorkedHours(hours: number | null): string {
  if (typeof hours !== 'number') return '--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export function ClockWidget(): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [elapsed, setElapsed] = useState('0h 0m');

  const attendanceQuery = useQuery({
    queryKey: ['attendance-today', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () =>
      fetchDashboardApi<TodayAttendancePayload>(
        '/api/v1/attendance/today',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      ),
    refetchInterval: 60_000,
  });

  const attendance = attendanceQuery.data?.data;

  useEffect(() => {
    if (!attendance?.clockIn || attendance.clockOut) {
      setElapsed('0h 0m');
      return;
    }

    setElapsed(formatElapsed(attendance.clockIn));

    const interval = setInterval(() => {
      setElapsed(formatElapsed(attendance.clockIn));
    }, 60_000);

    return () => clearInterval(interval);
  }, [attendance?.clockIn, attendance?.clockOut]);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      return fetchDashboardApi('/api/v1/attendance/clock-in', user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      return fetchDashboardApi('/api/v1/attendance/clock-out', user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    },
  });

  const label = useMemo(() => {
    const now = new Date();
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(now);
  }, []);

  if (attendanceQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading attendance status...</CardContent>
      </Card>
    );
  }

  if (!attendance) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Attendance status is unavailable right now.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today · {label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attendance.status === 'ON_LEAVE' ? (
          <div className="space-y-1 text-sm">
            <p className="text-foreground">You are on approved leave today.</p>
            <p className="text-muted-foreground">No sign-in required.</p>
          </div>
        ) : null}

        {attendance.status === 'WEEKEND' ? (
          <div className="space-y-1 text-sm">
            <p className="text-foreground">It's the weekend.</p>
            <p className="text-muted-foreground">No sign-in required today.</p>
          </div>
        ) : null}

        {attendance.clockIn && !attendance.clockOut ? (
          <div className="space-y-2 text-sm">
            <p className="text-foreground">You are signed in.</p>
            <p className="text-muted-foreground">Signed in at {formatTime(attendance.clockIn)}</p>
            <p className="font-mono tabular-nums text-foreground">Working for {elapsed}</p>
          </div>
        ) : null}

        {attendance.clockIn && attendance.clockOut ? (
          <div className="space-y-1 text-sm">
            <p className="text-foreground">Done for today.</p>
            <p className="text-muted-foreground">Signed in: {formatTime(attendance.clockIn)}</p>
            <p className="text-muted-foreground">Signed out: {formatTime(attendance.clockOut)}</p>
            <p className="font-mono tabular-nums text-foreground">Hours worked: {formatWorkedHours(attendance.workedHours)}</p>
          </div>
        ) : null}

        {!attendance.clockIn && attendance.status !== 'ON_LEAVE' && attendance.status !== 'WEEKEND' ? (
          <p className="text-sm text-muted-foreground">You have not signed in yet.</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            onClick={() => clockInMutation.mutate()}
            disabled={!attendance.canClockIn || clockInMutation.isPending}
          >
            {clockInMutation.isPending ? 'Signing In...' : 'Sign In'}
          </Button>
          <Button
            variant="outline"
            onClick={() => clockOutMutation.mutate()}
            disabled={!attendance.canClockOut || clockOutMutation.isPending}
          >
            {clockOutMutation.isPending ? 'Signing Out...' : 'Sign Out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
