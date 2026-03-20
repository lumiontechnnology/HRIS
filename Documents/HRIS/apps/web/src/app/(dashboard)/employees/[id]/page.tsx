'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from '@lumion/ui';
import { Avatar, Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';
import { createClient } from '@/lib/supabase/client';

interface EmployeeDetailResponse {
  data: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    avatar?: string | null;
    email: string;
    phone?: string | null;
    employmentStatus: string;
    department?: { name?: string | null } | null;
    jobTitle?: { title?: string | null } | null;
    manager?: { firstName?: string | null; lastName?: string | null } | null;
    location?: { name?: string | null } | null;
  };
}

export default function EmployeeProfilePage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaved, setAvatarSaved] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ui-employee-profile', params.id, user?.id, user?.tenantId],
    enabled: !!params.id && !!user?.tenantId,
    queryFn: async () => {
      const response = await fetchDashboardApi<EmployeeDetailResponse>(
        `/api/v1/employees/${params.id}`,
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Employee Profile" description="Loading employee profile." />
        <div className="grid gap-3 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Employee Profile" description="Employee record was not found." />
        <Card>
          <CardContent className="py-8 text-sm text-slate-600">
            The selected employee does not exist in the current dataset.
          </CardContent>
        </Card>
      </div>
    );
  }

  const managerName = `${data.manager?.firstName ?? ''} ${data.manager?.lastName ?? ''}`.trim() || 'Not Assigned';
  const statusTone = data.employmentStatus === 'ACTIVE' ? 'success' : 'warning';

  const effectiveAvatar = avatarSaved || data.avatar || null;

  const saveAvatar = async () => {
    setAvatarError(null);
    setAvatarSaved(null);

    if (!avatarUrl.trim()) {
      setAvatarError('Please enter a valid image URL.');
      return;
    }

    setIsSavingAvatar(true);
    try {
      const response = await fetch(`/api/employees/${data.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarUrl.trim() }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string; data?: { avatar?: string } };

      if (!response.ok || !payload.success || !payload.data?.avatar) {
        setAvatarError(payload.error || 'Unable to save profile image.');
        return;
      }

      setAvatarSaved(payload.data.avatar);
      setAvatarUrl('');
    } catch {
      setAvatarError('Unable to save profile image.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarError(null);
    setAvatarSaved(null);
    setIsSavingAvatar(true);

    try {
      if (!file.type.startsWith('image/')) {
        setAvatarError('Please upload an image file.');
        return;
      }

      const extension = file.name.split('.').pop() || 'jpg';
      const filePath = `${data.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        setAvatarError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const response = await fetch(`/api/employees/${data.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: publicUrlData.publicUrl }),
      });

      const payload = (await response.json()) as { success?: boolean; error?: string; data?: { avatar?: string } };

      if (!response.ok || !payload.success || !payload.data?.avatar) {
        setAvatarError(payload.error || 'Unable to save uploaded profile image.');
        return;
      }

      setAvatarSaved(payload.data.avatar);
    } catch {
      setAvatarError('Unable to upload profile image.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Employee Profile"
        description="Comprehensive profile with payroll, leave, documents, and performance context."
        actions={<Button variant="outline">Edit Profile</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <Avatar name={`${data.firstName} ${data.lastName}`} src={effectiveAvatar} size="lg" />
            <div>
              <CardTitle>{`${data.firstName} ${data.lastName}`.trim()}</CardTitle>
              <CardDescription>
                {data.jobTitle?.title || 'Not Assigned'} • {data.department?.name || 'Unassigned'}
              </CardDescription>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="info">{data.employeeId}</Badge>
                <Badge tone={statusTone}>{data.employmentStatus}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="payroll">Payroll</TabsTrigger>
                <TabsTrigger value="leave">Leave</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <p>Email: {data.email}</p>
                      <p>Phone: {data.phone || 'Not provided'}</p>
                      <p>Location: {data.location?.name || 'Remote'}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Employment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <p>Department: {data.department?.name || 'Unassigned'}</p>
                      <p>Role: {data.jobTitle?.title || 'Not Assigned'}</p>
                      <p>Manager: {managerName}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Profile Picture</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>Add your own image URL to update this employee avatar.</p>
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={(event) => setAvatarUrl(event.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const selectedFile = event.target.files?.[0];
                          if (selectedFile) {
                            void uploadAvatar(selectedFile);
                          }
                        }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                      <Button onClick={saveAvatar} disabled={isSavingAvatar}>
                        {isSavingAvatar ? 'Saving...' : 'Save Avatar'}
                      </Button>
                      {avatarError ? <p className="text-sm text-destructive">{avatarError}</p> : null}
                      {avatarSaved ? <p className="text-sm text-[hsl(var(--success))]">Avatar updated successfully.</p> : null}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="payroll" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Payroll Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <p>Base salary, allowances, deductions, tax history, and payslip access.</p>
                    <Button variant="outline" asChild>
                      <a href={`/employees/${data.id}/compensation`}>Manage compensation components</a>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="leave" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Leave History</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-700">Leave balances, requests, and approval outcomes across annual and sick leave.</CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-700">Contract files, compliance forms, and personnel document versions.</CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-700">Goals progress, review scores, and development recommendations.</CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manager Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-slate-900">{managerName}</p>
              <p className="text-slate-600">Leadership Chain</p>
              <Button variant="outline" size="sm" className="w-full">View Manager Profile</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">Create Performance Review</Button>
              <Button variant="outline" className="w-full">Generate Payslip</Button>
              <Button className="w-full">Submit Leave Request</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
