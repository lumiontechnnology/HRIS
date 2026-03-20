'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  size?: string;
  plan: string;
  isActive: boolean;
  onboardingComplete: boolean;
  employeesCount: number;
  trialEndsAt: string;
  createdAt: string;
};

export default function LumionAdminPage(): JSX.Element {
  const [masterPassword, setMasterPassword] = useState('');
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingTenantId, setActionLoadingTenantId] = useState<string | null>(null);

  async function loadTenants() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/lumion-admin/tenants', {
        headers: {
          'x-lumion-master-password': masterPassword,
        },
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Unauthorized');
      }

      setTenants(payload.data as TenantRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTenantActive(tenantId: string, nextIsActive: boolean) {
    setError(null);
    setActionLoadingTenantId(tenantId);

    try {
      const response = await fetch('/api/lumion-admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-lumion-master-password': masterPassword,
        },
        body: JSON.stringify({ tenantId, isActive: nextIsActive }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Failed to update tenant status');
      }

      setTenants((prev) => prev.map((tenant) => (
        tenant.id === tenantId ? { ...tenant, isActive: nextIsActive } : tenant
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update tenant status');
    } finally {
      setActionLoadingTenantId(null);
    }
  }

  async function impersonateTenant(tenantId: string) {
    setError(null);
    setActionLoadingTenantId(tenantId);

    try {
      const response = await fetch('/api/lumion-admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lumion-master-password': masterPassword,
        },
        body: JSON.stringify({ tenantId }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Failed to generate impersonation link');
      }

      const actionLink = payload?.data?.actionLink as string | undefined;
      if (!actionLink) {
        throw new Error('No impersonation link received');
      }

      window.open(actionLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to impersonate tenant');
    } finally {
      setActionLoadingTenantId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Lumion Master Admin</CardTitle>
          <CardDescription>Internal multi-tenant support panel.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Input type="password" placeholder="Master password" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} />
          <Button onClick={loadTenants} disabled={loading || !masterPassword}>{loading ? 'Loading...' : 'Load Tenants'}</Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>{tenants.length} tenant(s)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Employees</th>
                <th className="px-3 py-2">Onboarding</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Trial Ends</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">{tenant.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{tenant.slug}</p>
                  </td>
                  <td className="px-3 py-2">{tenant.plan}</td>
                  <td className="px-3 py-2">{tenant.employeesCount}</td>
                  <td className="px-3 py-2">{tenant.onboardingComplete ? 'Complete' : 'Pending'}</td>
                  <td className="px-3 py-2">{tenant.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">{new Date(tenant.trialEndsAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoadingTenantId === tenant.id || !masterPassword}
                        onClick={() => toggleTenantActive(tenant.id, !tenant.isActive)}
                      >
                        {tenant.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionLoadingTenantId === tenant.id || !masterPassword}
                        onClick={() => impersonateTenant(tenant.id)}
                      >
                        Impersonate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
