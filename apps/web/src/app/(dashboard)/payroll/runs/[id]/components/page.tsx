'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from '@lumion/ui';
import { SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

type VariableComponentRow = {
  employee_id: string;
  staff_id: string;
  employee_name: string;
  component_id: string;
  component_name: string;
  component_code: string;
  amount: number | null;
};

export default function PayrollRunComponentsPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const runId = params.id;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const canEdit = ['HR_ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payroll-run-components', runId, user?.id],
    enabled: !!runId && !!user,
    queryFn: async () => {
      const response = await fetchDashboardApi<{ data: VariableComponentRow[] }>(
        `/api/v1/payroll/runs/${runId}/components`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
      return response.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = data || [];
      const items = rows.map((row) => {
        const key = `${row.employee_id}:${row.component_id}`;
        return {
          employeeId: row.employee_id,
          componentId: row.component_id,
          amount: Number(draft[key] ?? row.amount ?? 0),
        };
      });

      return fetchDashboardApi(`/api/v1/payroll/runs/${runId}/components`, user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
    },
    onSuccess: async () => {
      toast({ title: 'Saved', description: 'Variable payroll components were saved.' });
      await refetch();
    },
    onError: () => {
      toast({ title: 'Save failed', description: 'Unable to save run components.', variant: 'destructive' });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, VariableComponentRow[]>();
    for (const row of data || []) {
      if (!map.has(row.employee_id)) {
        map.set(row.employee_id, []);
      }
      map.get(row.employee_id)?.push(row);
    }
    return Array.from(map.entries()).map(([employeeId, rows]) => ({
      employeeId,
      employeeName: rows[0]?.employee_name || 'Employee',
      staffId: rows[0]?.staff_id || '-',
      rows,
    }));
  }, [data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Variable Components"
        description="Set one-time run amounts for bonuses and variable payroll components."
      />

      {!canEdit ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Only HR_ADMIN or SUPER_ADMIN can edit variable components for a payroll run.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Run Inputs</CardTitle>
          <CardDescription>Blank values default to zero for this payroll run.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading variable components...</div>
          ) : grouped.length === 0 ? (
            <div className="text-sm text-muted-foreground">No variable components configured for active employees.</div>
          ) : (
            <div className="space-y-4">
              {grouped.map((employee) => (
                <div key={employee.employeeId} className="border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-medium text-foreground">{employee.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{employee.staffId}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {employee.rows.map((row) => {
                      const key = `${row.employee_id}:${row.component_id}`;
                      return (
                        <div key={key} className="space-y-1">
                          <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{row.component_name}</label>
                          <Input
                            value={draft[key] ?? String(row.amount ?? '')}
                            onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder="0"
                            disabled={!canEdit}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !canEdit}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
