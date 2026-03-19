'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, useToast } from '@lumion/ui';
import { SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

type EmployeeComponentLine = {
  id: string;
  component_id: string;
  amount: number;
  name: string;
  code: string;
  is_taxable: boolean;
  is_pensionable: boolean;
};

type PayrollComponentOption = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

function currency(value: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value || 0);
}

export default function EmployeeCompensationPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [componentId, setComponentId] = useState('');
  const [amount, setAmount] = useState('');

  const employeeId = params.id;
  const canEdit = ['HR_ADMIN', 'SUPER_ADMIN'].includes((user?.role || '').toUpperCase());

  const componentsQuery = useQuery({
    queryKey: ['employee-compensation', employeeId, user?.id],
    enabled: !!user && !!employeeId,
    queryFn: async () => {
      const response = await fetchDashboardApi<{ data: EmployeeComponentLine[] }>(
        `/api/v1/payroll/employees/${employeeId}/components`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
      return response.data;
    },
  });

  const optionsQuery = useQuery({
    queryKey: ['employee-comp-options', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetchDashboardApi<{ data: PayrollComponentOption[] }>(
        '/api/v1/payroll/settings/payroll-components',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
      return response.data.filter((component) => component.is_active);
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      return fetchDashboardApi(`/api/v1/payroll/employees/${employeeId}/components`, user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'POST',
        body: JSON.stringify({
          componentId,
          amount: Number(amount || 0),
          effectiveFrom: new Date().toISOString().slice(0, 10),
        }),
      });
    },
    onSuccess: () => {
      setComponentId('');
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['employee-compensation', employeeId] });
      toast({ title: 'Component added', description: 'Compensation item assigned successfully.' });
    },
    onError: () => {
      toast({ title: 'Assignment failed', description: 'Unable to assign this component.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fetchDashboardApi(`/api/v1/payroll/employees/${employeeId}/components/${id}`, user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-compensation', employeeId] });
    },
  });

  const lines = useMemo(() => componentsQuery.data || [], [componentsQuery.data]);

  const gross = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const taxable = lines.filter((line) => line.is_taxable).reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const pensionBase = lines.filter((line) => line.is_pensionable).reduce((sum, line) => sum + Number(line.amount || 0), 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Compensation" description="Component-driven compensation profile for this employee." />

      {!canEdit ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Only HR_ADMIN or SUPER_ADMIN can modify employee compensation components.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current Components</CardTitle>
          <CardDescription>Taxable and pensionable rules are inherited from component configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          {componentsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading compensation...</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-4 py-3">Component</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Taxable</th>
                      <th className="px-4 py-3">Pensionable</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b border-border/60">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{line.name}</div>
                          <div className="text-xs text-muted-foreground">{line.code}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{currency(Number(line.amount || 0))}</td>
                        <td className="px-4 py-3">{line.is_taxable ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3">{line.is_pensionable ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(line.component_id)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 border border-border p-4 md:grid-cols-2">
                <div className="text-sm text-muted-foreground">Gross Salary</div>
                <div className="text-right font-mono tabular-nums text-foreground">{currency(gross)}</div>
                <div className="text-sm text-muted-foreground">Taxable Income</div>
                <div className="text-right font-mono tabular-nums text-foreground">{currency(taxable)}</div>
                <div className="text-sm text-muted-foreground">Pension Base</div>
                <div className="text-right font-mono tabular-nums text-foreground">{currency(pensionBase)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Component</CardTitle>
          <CardDescription>Assign an active payroll component to this employee.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={componentId}
            onChange={(event) => setComponentId(event.target.value)}
            disabled={!canEdit}
          >
            <option value="">Select component</option>
            {(optionsQuery.data || []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.code})
              </option>
            ))}
          </select>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" disabled={!canEdit} />
          <Button disabled={!canEdit || !componentId || addMutation.isPending} onClick={() => addMutation.mutate()}>
            Assign
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
