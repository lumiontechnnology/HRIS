'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { useState } from 'react';
import { SectionHeader, Badge } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface EmployeeDetailResponse {
  data: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    hireDate: string;
    terminationDate?: string | null;
    employmentStatus: string;
    jobTitle?: { title?: string | null } | null;
    department?: { name?: string | null } | null;
    latestExit?: {
      exitType?: string;
      exitReason?: string | null;
      exitInterviewNotes?: string | null;
      lastWorkingDay?: string;
      isEligibleRehire?: boolean;
      finalSettlementPaid?: boolean;
      finalSettlementAmount?: string | null;
      finalSettlementDate?: string | null;
      rehireNotes?: string | null;
    } | null;
    employmentHistory?: Array<{
      id: string;
      stintNumber: number;
      hireDate: string;
      exitDate?: string | null;
      exitType?: string | null;
      notes?: string | null;
    }>;
    offboardingTasks?: Array<{
      id: string;
      title: string;
      assigneeRole: string;
      dueDate: string;
      status: string;
    }>;
  };
}

export default function ExitedEmployeeProfilePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [newHireDate, setNewHireDate] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [rehireReason, setRehireReason] = useState('');

  const detailQuery = useQuery({
    queryKey: ['employee-exited-profile', params.id, user?.id, user?.tenantId],
    enabled: !!params.id && !!user?.id && !!user?.tenantId,
    queryFn: () =>
      fetchDashboardApi<EmployeeDetailResponse>(
        `/api/v1/employees/${params.id}`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      ),
  });

  const data = detailQuery.data?.data;

  const rehireMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      return fetchDashboardApi(
        `/api/v1/employees/${data.id}/rehire`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            newHireDate,
            newJobTitle: data.jobTitle?.title || '',
            newDepartment: data.department?.name || '',
            newSalary: Number(newSalary),
            rehireReason,
          }),
        }
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employee-exited-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['employees-exited'] });
    },
  });

  if (detailQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Former employee record not found.</CardContent>
      </Card>
    );
  }

  const eligible = data.latestExit?.isEligibleRehire ?? false;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`${data.firstName} ${data.lastName}`}
        description="Exited employee profile (read-only archive)"
      />

      <Card>
        <CardHeader>
          <CardTitle>Exit Summary</CardTitle>
          <CardDescription>Last stint details and settlement status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <p><span className="text-muted-foreground">Employee ID:</span> <span className="font-mono">{data.employeeId}</span></p>
          <p><span className="text-muted-foreground">Status:</span> {data.employmentStatus}</p>
          <p><span className="text-muted-foreground">Exit Type:</span> {data.latestExit?.exitType || '—'}</p>
          <p><span className="text-muted-foreground">Last Working Day:</span> {data.latestExit?.lastWorkingDay ? new Date(data.latestExit.lastWorkingDay).toLocaleDateString() : '—'}</p>
          <p><span className="text-muted-foreground">Final Settlement Paid:</span> {data.latestExit?.finalSettlementPaid ? 'Yes' : 'No'}</p>
          <p><span className="text-muted-foreground">Final Settlement Amount:</span> {data.latestExit?.finalSettlementAmount || '—'}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Exit Reason:</span> {data.latestExit?.exitReason || '—'}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Exit Interview Notes:</span> {data.latestExit?.exitInterviewNotes || '—'}</p>
          <p className="md:col-span-2"><span className="text-muted-foreground">Rehire Notes:</span> {data.latestExit?.rehireNotes || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment Timeline</CardTitle>
          <CardDescription>All recorded stints at Lumion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(data.employmentHistory || []).length === 0 ? (
            <p className="text-muted-foreground">No employment history was found.</p>
          ) : (
            (data.employmentHistory || []).map((row) => (
              <div key={row.id} className="rounded-md border border-border px-3 py-2">
                <p className="text-foreground">
                  Stint {row.stintNumber}: {new Date(row.hireDate).toLocaleDateString()} → {row.exitDate ? new Date(row.exitDate).toLocaleDateString() : 'present'}
                </p>
                <p className="text-muted-foreground">{row.exitType || 'Active'} · {row.notes || 'No notes'}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assets Returned Checklist</CardTitle>
          <CardDescription>Offboarding tasks completed by IT, HR, finance, manager, and employee</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(data.offboardingTasks || []).length === 0 ? (
            <p className="text-muted-foreground">No offboarding checklist tasks were found.</p>
          ) : (
            (data.offboardingTasks || []).map((task) => (
              <div key={task.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.assigneeRole} · due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
                <Badge tone={task.status === 'COMPLETED' ? 'success' : 'neutral'}>{task.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card id="rehire">
        <CardHeader>
          <CardTitle>Rehire</CardTitle>
          <CardDescription>One-click rehire workflow for eligible former staff</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Badge tone={eligible ? 'success' : 'neutral'}>{eligible ? 'Eligible for rehire' : 'Not eligible for rehire'}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input type="date" value={newHireDate} onChange={(event) => setNewHireDate(event.target.value)} placeholder="New hire date" />
            <Input type="number" value={newSalary} onChange={(event) => setNewSalary(event.target.value)} placeholder="New monthly salary" />
            <Input value={rehireReason} onChange={(event) => setRehireReason(event.target.value)} placeholder="Rehire reason" />
          </div>
          <Button
            disabled={!eligible || rehireMutation.isPending || !newHireDate || !newSalary || !rehireReason}
            onClick={() => rehireMutation.mutate()}
          >
            {rehireMutation.isPending ? 'Rehiring...' : 'Rehire Employee'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
