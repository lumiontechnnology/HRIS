'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface RoleUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  assignedAt: string;
}

const AVAILABLE_ROLES = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'HEAD_OF_HR',
  'PAYROLL_AUDITOR',
  'FINANCE_OFFICER',
  'MANAGER',
  'EMPLOYEE',
];

export default function RolesSettingsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const { data, refetch } = useQuery({
    queryKey: ['roles-users', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: () =>
      fetchDashboardApi<{ data: RoleUser[] }>(
        '/api/v1/admin/roles',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      ),
  });

  const users = data?.data || [];
  const isSuperAdmin = useMemo(() => user?.role === 'SUPER_ADMIN', [user?.role]);

  const assignRole = async (targetUserId: string, role: string) => {
    if (!user?.id || !user?.tenantId) return;

    await fetchDashboardApi('/api/v1/admin/roles', { id: user.id, tenantId: user.tenantId }, {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId, role, reason: 'Role updated from settings' }),
    });

    toast({ title: 'Role updated', description: `User role changed to ${role}.` });
    await refetch();
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Only Super Admin can access role assignment settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">Employee</th>
                <th className="py-2">Email</th>
                <th className="py-2">Current role</th>
                <th className="py-2">Department</th>
                <th className="py-2">Assigned date</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-3">{item.name}</td>
                  <td className="py-3 text-muted-foreground">{item.email}</td>
                  <td className="py-3">
                    <Select value={item.role} onValueChange={(value) => assignRole(item.id, value)}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3">{item.department}</td>
                  <td className="py-3 text-muted-foreground">{new Date(item.assignedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
