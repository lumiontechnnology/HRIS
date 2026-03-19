'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Button } from '@lumion/ui';
import { SectionHeader } from '@/components/system/primitives';

export default function SettingsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Configure organization, policies, and system preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization Profile</CardTitle>
            <CardDescription>Core tenant details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input defaultValue="Lumion Technology" />
            <Input defaultValue="admin@lumiontech.com" />
            <Input defaultValue="Africa/Lagos" />
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval Policies</CardTitle>
            <CardDescription>Define enterprise control defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>Leave requests require manager approval.</p>
            <p>Payroll disbursement requires finance sign-off.</p>
            <p>New job requisitions require HR approval.</p>
            <Button variant="outline">Edit Policy Rules</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Management</CardTitle>
            <CardDescription>Assign and revoke platform roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Access level updates are tracked in the audit trail and immediately affect dashboard routing.
            </p>
            <Button variant="outline" asChild>
              <a href="/settings/roles">Manage roles</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
