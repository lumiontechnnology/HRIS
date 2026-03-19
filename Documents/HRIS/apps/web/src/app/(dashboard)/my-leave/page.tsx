'use client';

import { Card, CardContent, CardHeader, CardTitle, Button } from '@lumion/ui';

export default function MyLeavePage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Leave</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Request and track your leave from this workspace.</p>
        <Button asChild>
          <a href="/leave/new">Create leave request</a>
        </Button>
      </CardContent>
    </Card>
  );
}
