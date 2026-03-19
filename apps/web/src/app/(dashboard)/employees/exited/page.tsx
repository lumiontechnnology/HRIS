'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { SectionHeader, Badge } from '@/components/system/primitives';

interface ExitedEmployee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  exitType: string | null;
  lastWorkingDay: string | null;
  isEligibleRehire: boolean;
}

interface ExitedResponse {
  data: ExitedEmployee[];
  total: number;
}

export default function ExitedStaffPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [query, setQuery] = useState('');
  const [exitType, setExitType] = useState('all');
  const [year, setYear] = useState('all');

  const canAccess = useMemo(() => {
    const roles = user?.roles || [];
    return roles.includes('HR_ADMIN') || roles.includes('SUPER_ADMIN') || roles.includes('HEAD_OF_HR');
  }, [user?.roles]);

  const { data, isLoading } = useQuery({
    queryKey: ['employees-exited', user?.id, user?.tenantId, query, exitType, year],
    enabled: !!user?.id && !!user?.tenantId && canAccess,
    queryFn: () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (exitType !== 'all') params.set('exitType', exitType);
      if (year !== 'all') params.set('year', year);

      return fetchDashboardApi<ExitedResponse>(
        `/api/v1/employees/exited?${params.toString()}`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
    },
  });

  if (!canAccess) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          You do not have access to the exited staff registry.
        </CardContent>
      </Card>
    );
  }

  const rows = data?.data || [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Exited Staff Registry"
        description={`${data?.total || 0} former employees`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by name/ID and refine by exit type or year</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Search name or employee ID" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select value={exitType} onValueChange={setExitType}>
            <SelectTrigger>
              <SelectValue placeholder="Exit Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exit Types</SelectItem>
              <SelectItem value="RESIGNATION">Resignation</SelectItem>
              <SelectItem value="TERMINATION">Termination</SelectItem>
              <SelectItem value="REDUNDANCY">Redundancy</SelectItem>
              <SelectItem value="RETIREMENT">Retirement</SelectItem>
              <SelectItem value="CONTRACT_END">Contract End</SelectItem>
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Former Employees</CardTitle>
          <CardDescription>Read-only archive with rehire eligibility</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading exited staff...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exited employees match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Exit Type</th>
                    <th className="px-4 py-3 font-medium">Last Day</th>
                    <th className="px-4 py-3 font-medium">Eligible</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/70">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-foreground">{row.firstName} {row.lastName}</p>
                          <p className="font-mono text-xs text-muted-foreground">{row.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.exitType || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.lastWorkingDay ? new Date(row.lastWorkingDay).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={row.isEligibleRehire ? 'success' : 'neutral'}>
                          {row.isEligibleRehire ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/employees/exited/${row.id}`}
                            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors duration-150 hover:bg-muted"
                          >
                            View
                          </Link>
                          {row.isEligibleRehire ? (
                            <Link
                              href={`/employees/exited/${row.id}#rehire`}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors duration-150 hover:bg-muted"
                            >
                              Rehire
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
