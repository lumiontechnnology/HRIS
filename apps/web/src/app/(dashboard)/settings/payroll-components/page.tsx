'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  useToast,
} from '@lumion/ui';
import { SectionHeader } from '@/components/system/primitives';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

type PayrollComponent = {
  id: string;
  name: string;
  code: string;
  type: string;
  frequency: string;
  is_taxable: boolean;
  is_pensionable: boolean;
  is_nhf_applicable: boolean;
  is_active: boolean;
};

export default function PayrollComponentsSettingsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState<PayrollComponent | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PayrollComponent>>({});

  const canManage = (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-components', user?.id, user?.tenantId],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetchDashboardApi<{ data: PayrollComponent[] }>(
        '/api/v1/payroll/settings/payroll-components',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<PayrollComponent> }) => {
      return fetchDashboardApi(`/api/v1/payroll/settings/payroll-components/${id}`, user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-components'] });
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Unable to save component update.', variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return fetchDashboardApi('/api/v1/payroll/settings/payroll-components', user ? { id: user.id, tenantId: user.tenantId } : undefined, {
        method: 'POST',
        body: JSON.stringify({
          name,
          code: code.toUpperCase(),
          type: 'ALLOWANCE',
          frequency: 'FIXED',
          is_taxable: false,
          is_pensionable: false,
          is_nhf_applicable: false,
          display_on_payslip: true,
          sort_order: 10,
        }),
      });
    },
    onSuccess: () => {
      setName('');
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['payroll-components'] });
      toast({ title: 'Component added', description: 'New payroll component has been created.' });
    },
    onError: () => {
      toast({ title: 'Create failed', description: 'Unable to create payroll component.', variant: 'destructive' });
    },
  });

  const rows = useMemo(() => data || [], [data]);
  const editingIsBasic = (editing?.code || '').toUpperCase() === 'BASIC' || (editing?.type || '').toUpperCase() === 'BASIC';
  const showBasicTaxWarning = editingIsBasic && editForm.is_taxable === false;
  const showFrequencyWarning = editing && editForm.frequency && editForm.frequency !== editing.frequency;

  const openEdit = (component: PayrollComponent) => {
    setEditing(component);
    setEditForm({
      name: component.name,
      type: component.type,
      frequency: component.frequency,
      is_taxable: component.is_taxable,
      is_pensionable: component.is_pensionable,
      is_nhf_applicable: component.is_nhf_applicable,
      is_active: component.is_active,
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editing) return;
    if (showBasicTaxWarning) {
      toast({
        title: 'Validation failed',
        description: 'BASIC must remain taxable.',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate(
      { id: editing.id, payload: editForm },
      {
        onSuccess: () => {
          setEditOpen(false);
          setEditing(null);
          toast({ title: 'Saved', description: 'Component settings updated.' });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Payroll Components"
        description="Configure taxable and pensionable earning rules for payroll calculations."
      />

      {!canManage ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Only SUPER_ADMIN can modify component configuration.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Component Rules</CardTitle>
          <CardDescription>Taxable and pensionable flags save instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading components...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Taxable</th>
                    <th className="px-4 py-3">Pensionable</th>
                    <th className="px-4 py-3">NHF</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((component) => (
                    <tr key={component.id} className="border-b border-border/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{component.name}</div>
                        <div className="text-xs text-muted-foreground">{component.code}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{component.type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{component.frequency}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={component.is_taxable ? 'default' : 'outline'}
                          disabled={!canManage || component.code === 'BASIC' || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: component.id, payload: { is_taxable: !component.is_taxable } })}
                        >
                          {component.is_taxable ? 'Yes' : 'No'}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={component.is_pensionable ? 'default' : 'outline'}
                          disabled={!canManage || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: component.id, payload: { is_pensionable: !component.is_pensionable } })}
                        >
                          {component.is_pensionable ? 'Yes' : 'No'}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={component.is_nhf_applicable ? 'default' : 'outline'}
                          disabled={!canManage || updateMutation.isPending}
                          onClick={() => updateMutation.mutate({ id: component.id, payload: { is_nhf_applicable: !component.is_nhf_applicable } })}
                        >
                          {component.is_nhf_applicable ? 'Yes' : 'No'}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" disabled={!canManage} onClick={() => openEdit(component)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Custom Component</CardTitle>
          <CardDescription>Create additional components like Car or Shift allowances.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Component name" disabled={!canManage} />
          <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="CODE" disabled={!canManage} />
          <Button disabled={!canManage || !name || !code || createMutation.isPending} onClick={() => createMutation.mutate()}>
            Add Component
          </Button>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payroll Component</DialogTitle>
            <DialogDescription>
              Update calculation flags and frequency. Changes apply to future payroll runs.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Code</label>
                <Input value={editing.code} disabled />
              </div>

              <div className="grid gap-2">
                <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Name</label>
                <Input
                  value={String(editForm.name || '')}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={!canManage}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Type</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={String(editForm.type || '')}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
                    disabled={!canManage}
                  >
                    {['BASIC', 'ALLOWANCE', 'BONUS', 'EXTRA_PAY', 'OVERTIME', 'DEDUCTION', 'STATUTORY'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Frequency</label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={String(editForm.frequency || '')}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, frequency: event.target.value }))}
                    disabled={!canManage}
                  >
                    {['FIXED', 'VARIABLE', 'PERCENTAGE', 'FORMULA'].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <Button
                  type="button"
                  variant={editForm.is_taxable ? 'default' : 'outline'}
                  onClick={() => setEditForm((prev) => ({ ...prev, is_taxable: !prev.is_taxable }))}
                  disabled={!canManage}
                >
                  Taxable: {editForm.is_taxable ? 'Yes' : 'No'}
                </Button>
                <Button
                  type="button"
                  variant={editForm.is_pensionable ? 'default' : 'outline'}
                  onClick={() => setEditForm((prev) => ({ ...prev, is_pensionable: !prev.is_pensionable }))}
                  disabled={!canManage}
                >
                  Pensionable: {editForm.is_pensionable ? 'Yes' : 'No'}
                </Button>
                <Button
                  type="button"
                  variant={editForm.is_nhf_applicable ? 'default' : 'outline'}
                  onClick={() => setEditForm((prev) => ({ ...prev, is_nhf_applicable: !prev.is_nhf_applicable }))}
                  disabled={!canManage}
                >
                  NHF: {editForm.is_nhf_applicable ? 'Yes' : 'No'}
                </Button>
                <Button
                  type="button"
                  variant={editForm.is_active ? 'default' : 'outline'}
                  onClick={() => setEditForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                  disabled={!canManage || editingIsBasic}
                >
                  Active: {editForm.is_active ? 'Yes' : 'No'}
                </Button>
              </div>

              {showBasicTaxWarning ? (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  BASIC must remain taxable and cannot be saved with taxable set to No.
                </div>
              ) : null}

              {showFrequencyWarning ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  Frequency changes may require compensation reassignment before the next payroll run.
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!canManage || updateMutation.isPending || showBasicTaxWarning}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
