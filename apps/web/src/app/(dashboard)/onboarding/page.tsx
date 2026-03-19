'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';

const steps = ['Company Profile', 'Work Schedule', 'Departments & Locations', 'Leave Policies', 'Invite Team'];

interface OnboardingStateResponse {
  success: boolean;
  data: {
    actor: { role: string };
    tenant: {
      name: string;
      onboardingComplete: boolean;
    };
  };
}

export default function OnboardingPage(): JSX.Element {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);

  const [workDaysRaw, setWorkDaysRaw] = useState('MON,TUE,WED,THU,FRI');
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [timezone, setTimezone] = useState('Africa/Lagos');

  const [departmentsRaw, setDepartmentsRaw] = useState('Human Resources');
  const [locationsRaw, setLocationsRaw] = useState('Head Office,Lagos');
  const [jobTitlesRaw, setJobTitlesRaw] = useState('HR Manager');

  const [annualLeaveDays, setAnnualLeaveDays] = useState(20);
  const [sickLeaveDays, setSickLeaveDays] = useState(10);
  const [extraLeavesRaw, setExtraLeavesRaw] = useState('');

  const [inviteEmails, setInviteEmails] = useState('');

  const stateQuery = useQuery({
    queryKey: ['onboarding-state', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch('/api/auth/onboarding/state', { cache: 'no-store' });
      const payload = (await response.json()) as OnboardingStateResponse;
      if (!response.ok || !payload.success) {
        throw new Error('Failed to load onboarding state');
      }
      return payload.data;
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async (body: unknown) => {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Save failed');
      }
      return payload;
    },
  });

  const inviteBulkMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const response = await fetch('/api/auth/invite-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails, role: 'EMPLOYEE' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Bulk invite failed');
      }
      return payload;
    },
  });

  const onboardingComplete = stateQuery.data?.tenant.onboardingComplete;

  if (stateQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading onboarding wizard...</div>;
  }

  if (stateQuery.data?.actor.role !== 'SUPER_ADMIN') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Super Admin Access Required</CardTitle>
          <CardDescription>Only SUPER_ADMIN can complete onboarding.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (onboardingComplete) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your workspace is ready</CardTitle>
          <CardDescription>Onboarding is complete for this tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  const submitStep = async () => {
    setError(null);

    try {
      if (stepIndex === 0) {
        await saveStepMutation.mutateAsync({
          step: 'company_profile',
          payload: { companyName, logoUrl, address, registrationNumber, fiscalYearStartMonth },
        });
      }

      if (stepIndex === 1) {
        await saveStepMutation.mutateAsync({
          step: 'work_schedule',
          payload: {
            workDays: workDaysRaw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
            workStart,
            workEnd,
            graceMinutes,
            timezone,
          },
        });
      }

      if (stepIndex === 2) {
        await saveStepMutation.mutateAsync({
          step: 'org_setup',
          payload: {
            departments: departmentsRaw.split(',').map((item) => item.trim()).filter(Boolean),
            locations: locationsRaw.split(/\n/).map((line) => {
              const [name, city] = line.split(',').map((part) => part.trim());
              return { name: name || line.trim(), city: city || 'Lagos' };
            }).filter((item) => item.name),
            jobTitles: jobTitlesRaw.split(',').map((item) => item.trim()).filter(Boolean),
          },
        });
      }

      if (stepIndex === 3) {
        await saveStepMutation.mutateAsync({
          step: 'leave_policies',
          payload: {
            annualLeaveDays,
            sickLeaveDays,
            extraLeaveTypes: extraLeavesRaw
              .split(/\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [name, days] = line.split(',').map((part) => part.trim());
                return { name, days: Number(days || '0') };
              })
              .filter((item) => item.name),
          },
        });
      }

      if (stepIndex === 4) {
        const emails = Array.from(
          new Set(
            inviteEmails
              .split(/[\n,]/)
              .map((email) => email.trim().toLowerCase())
              .filter(Boolean)
          )
        );

        if (emails.length > 0) {
          await inviteBulkMutation.mutateAsync(emails);
        }

        await saveStepMutation.mutateAsync({ step: 'complete', payload: {} });
        router.push('/');
        return;
      }

      setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save step');
    }
  };

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Onboarding</CardTitle>
          <CardDescription>Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 rounded bg-muted">
            <div className="h-2 rounded bg-foreground" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {stepIndex === 0 ? (
        <Card>
          <CardHeader><CardTitle>Company Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Company Name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            <Input placeholder="Logo URL" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
            <Input placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
            <Input placeholder="Registration Number" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} />
            <Input type="number" min={1} max={12} placeholder="Fiscal Year Start Month" value={String(fiscalYearStartMonth)} onChange={(event) => setFiscalYearStartMonth(Number(event.target.value || '1'))} />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 1 ? (
        <Card>
          <CardHeader><CardTitle>Work Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Work Days (comma-separated)" value={workDaysRaw} onChange={(event) => setWorkDaysRaw(event.target.value)} />
            <Input placeholder="Work Start (08:00)" value={workStart} onChange={(event) => setWorkStart(event.target.value)} />
            <Input placeholder="Work End (17:00)" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} />
            <Input type="number" placeholder="Grace Minutes" value={String(graceMinutes)} onChange={(event) => setGraceMinutes(Number(event.target.value || '0'))} />
            <Input placeholder="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 2 ? (
        <Card>
          <CardHeader><CardTitle>Departments & Locations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Departments (comma-separated)" value={departmentsRaw} onChange={(event) => setDepartmentsRaw(event.target.value)} />
            <textarea className="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Locations, one per line: Name,City" value={locationsRaw} onChange={(event) => setLocationsRaw(event.target.value)} />
            <Input placeholder="Job Titles (comma-separated)" value={jobTitlesRaw} onChange={(event) => setJobTitlesRaw(event.target.value)} />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 3 ? (
        <Card>
          <CardHeader><CardTitle>Leave Policies</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="number" placeholder="Annual Leave Days" value={String(annualLeaveDays)} onChange={(event) => setAnnualLeaveDays(Number(event.target.value || '0'))} />
            <Input type="number" placeholder="Sick Leave Days" value={String(sickLeaveDays)} onChange={(event) => setSickLeaveDays(Number(event.target.value || '0'))} />
            <textarea className="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="Extra Leave Types, one per line: Name,Days" value={extraLeavesRaw} onChange={(event) => setExtraLeavesRaw(event.target.value)} />
          </CardContent>
        </Card>
      ) : null}

      {stepIndex === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite Your Team</CardTitle>
            <CardDescription>Paste one email per line or comma-separated. Employees get invite links.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea className="min-h-[150px] w-full rounded-md border border-input bg-background p-3 text-sm" placeholder="jane@company.com\njoe@company.com" value={inviteEmails} onChange={(event) => setInviteEmails(event.target.value)} />
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={stepIndex === 0 || saveStepMutation.isPending} onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}>Back</Button>
        <Button onClick={submitStep} disabled={saveStepMutation.isPending || inviteBulkMutation.isPending}>
          {stepIndex === 4 ? 'Finish onboarding' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}
