'use client';

import { Button } from '@lumion/ui';
import { SectionHeader } from '@/components/system/primitives';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard Error"
        description="Something went wrong while loading this page."
      />

      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <p className="text-sm font-medium">Client error encountered.</p>
        <p className="mt-1 text-sm">{error.message || 'Unexpected error'}</p>
      </div>

      <Button onClick={() => reset()}>Try Again</Button>
    </div>
  );
}
