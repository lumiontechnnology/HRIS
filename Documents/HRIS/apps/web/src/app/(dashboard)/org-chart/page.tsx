'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { CardSkeleton, SectionHeader } from '@/components/system/primitives';

interface OrgChartEmployee {
  id: string;
  managerId: string | null;
  name: string;
  role: string;
  department: string;
  avatar?: string | null;
}

interface OrgChartResponse {
  success: boolean;
  data: OrgChartEmployee[];
}

export default function OrgChartPage(): JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['org-chart'],
    queryFn: async () => {
      const response = await fetch('/api/org-chart');
      if (!response.ok) {
        throw new Error('Failed to load org chart');
      }

      const payload = (await response.json()) as OrgChartResponse;
      return payload.data || [];
    },
  });

  const employees = data ?? [];

  const childrenByManager = useMemo(() => {
    const map = new Map<string | null, OrgChartEmployee[]>();

    for (const employee of employees) {
      const key = employee.managerId || null;
      const existing = map.get(key) || [];
      existing.push(employee);
      map.set(key, existing);
    }

    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return employees;
    return employees.filter((row) => row.name.toLowerCase().includes(normalized));
  }, [employees, query]);

  const filteredIds = useMemo(() => new Set(filtered.map((item) => item.id)), [filtered]);

  const roots = useMemo(() => {
    return employees.filter((employee) => !employee.managerId);
  }, [employees]);

  const renderNode = (node: OrgChartEmployee, depth = 0): JSX.Element => {
    if (!filteredIds.has(node.id)) {
      return <></>;
    }

    const reports = (childrenByManager.get(node.id) || []).filter((report) => filteredIds.has(report.id));

    return (
      <div key={node.id} className="space-y-3" style={{ marginLeft: depth > 0 ? '1.5rem' : 0 }}>
        <button
          type="button"
          onClick={() => router.push(`/employees/${node.id}`)}
          className="w-full rounded-md border border-border bg-card px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/30"
        >
          <p className="font-medium text-foreground">{node.name}</p>
          <p className="text-sm text-muted-foreground">{node.role} • {node.department}</p>
        </button>
        {reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => renderNode(report, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Org Chart"
        description="Browse reporting relationships and open employee profiles directly from each node."
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
          placeholder="Search org nodes"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Tree</CardTitle>
          <CardDescription>Click any node to open employee profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : roots.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              No active employees found for org chart.
            </div>
          ) : (
            roots.map((root) => renderNode(root))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
