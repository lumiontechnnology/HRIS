'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, useToast } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { fetchDashboardApi } from '@/lib/dashboard-api';

interface ProfileResponse {
  data: {
    email: string;
    firstName: string;
    lastName: string;
    employee: {
      phone?: string | null;
      personalEmail?: string | null;
    };
  };
}

export default function MyProfilePage(): JSX.Element {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');

  const { data, refetch } = useQuery({
    queryKey: ['me-profile', user?.id, user?.tenantId],
    enabled: !!user?.id && !!user?.tenantId,
    queryFn: async () => {
      const response = await fetchDashboardApi<ProfileResponse>('/api/v1/me/profile', user ? { id: user.id, tenantId: user.tenantId } : undefined);
      setPhone(response.data.employee.phone || '');
      setPersonalEmail(response.data.employee.personalEmail || '');
      return response;
    },
  });

  const save = async () => {
    if (!user?.id || !user?.tenantId) return;

    await fetchDashboardApi('/api/v1/me/profile', { id: user.id, tenantId: user.tenantId }, {
      method: 'PATCH',
      body: JSON.stringify({ phone, personalEmail }),
    });

    toast({ title: 'Profile updated', description: 'Your profile changes were saved.' });
    await refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input value={data?.data.firstName || ''} disabled />
        <Input value={data?.data.lastName || ''} disabled />
        <Input value={data?.data.email || ''} disabled />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
        <Input value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} placeholder="Personal email" />
        <div className="flex justify-end">
          <Button onClick={save}>Save updates</Button>
        </div>
      </CardContent>
    </Card>
  );
}
