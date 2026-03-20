'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { createClient } from '@/lib/supabase/client';

function routeForRole(role: string): string {
  const normalized = role.toUpperCase();
  if (['SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR', 'MANAGER'].includes(normalized)) return '/';
  if (normalized === 'FINANCE_OFFICER') return '/payroll';
  if (normalized === 'PAYROLL_AUDITOR') return '/payroll';
  return '/my-dashboard';
}

export default function AcceptInvitePage(): JSX.Element {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invitedName, setInvitedName] = useState<string>('Team Member');
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const fromMetadata = (data.user?.user_metadata?.full_name as string | undefined) || '';
      const fallbackEmailName = (data.user?.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
      setInvitedName(fromMetadata || fallbackEmailName || 'Team Member');
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSetPassword() {
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const roleFromMetadata =
        (user?.user_metadata?.role as string | undefined) ||
        (Array.isArray(user?.user_metadata?.roles) ? String((user?.user_metadata?.roles as string[])[0] || '') : '');

      router.push(routeForRole(roleFromMetadata || 'EMPLOYEE'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>Welcome {invitedName}. Set your password to activate your employee account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="password" placeholder="New Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={handleSetPassword} disabled={saving}>{saving ? 'Saving...' : 'Set Password'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
