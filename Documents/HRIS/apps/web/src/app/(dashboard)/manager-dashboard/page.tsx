'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  jobTitle?: { title?: string };
  leaveBalances?: Array<{ leaveType?: { name?: string }; available: number }>;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  employee: { firstName: string; lastName: string };
  leaveType: { name: string };
}

export default function ManagerDashboardPage(): JSX.Element {
  const { user } = useCurrentUser();

  const { data: teamData } = useQuery({
    queryKey: ['manager-team', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () => fetchDashboardApi<{ data: TeamMember[] }>('/api/v1/manager/team', user ? { id: user.id, tenantId: user.tenantId } : undefined),
  });

  const { data: leaveData, refetch: refetchLeave } = useQuery({
    queryKey: ['manager-leave-requests', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () => fetchDashboardApi<{ data: LeaveRequest[] }>('/api/v1/manager/team/leave-requests', user ? { id: user.id, tenantId: user.tenantId } : undefined),
  });

  const team = teamData?.data || [];
  const leaveRequests = leaveData?.data || [];

  const handleLeaveAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (!user?.tenantId || !user?.id) return;
    await fetchDashboardApi(`/api/v1/manager/leave-requests/${id}`, { id: user.id, tenantId: user.tenantId }, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
    await refetchLeave();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-normal tracking-tight text-foreground">My Team</h1>
        <p className="mt-2 text-sm text-muted-foreground">{team.length} members · {leaveRequests.length} pending approvals</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active members</CardTitle></CardHeader>
          <CardContent><p className="font-mono text-3xl tabular-nums">{team.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">On leave (pending)</CardTitle></CardHeader>
          <CardContent><p className="font-mono text-3xl tabular-nums">{leaveRequests.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Approvals queue</CardTitle></CardHeader>
          <CardContent><p className="font-mono text-3xl tabular-nums">{leaveRequests.length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My Team</CardTitle>
          <CardDescription>Direct reports only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2">Name</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Leave Balance</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.id} className="border-b border-border/60">
                    <td className="py-3">{member.firstName} {member.lastName}</td>
                    <td className="py-3">{member.jobTitle?.title || 'Not assigned'}</td>
                    <td className="py-3">{member.leaveBalances?.[0]?.available ?? 0} days</td>
                    <td className="py-3">{member.employmentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Leave Approvals</CardTitle>
          <CardDescription>Approve or reject requests from your team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {leaveRequests.map((request) => (
            <div key={request.id} className="rounded-md border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {request.employee.firstName} {request.employee.lastName} — {request.leaveType.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(request.startDate).toLocaleDateString()} → {new Date(request.endDate).toLocaleDateString()}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => handleLeaveAction(request.id, 'APPROVE')}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => handleLeaveAction(request.id, 'REJECT')}>Reject</Button>
              </div>
            </div>
          ))}

          {leaveRequests.length === 0 && (
            <div className="text-sm text-muted-foreground">No pending team leave requests.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
