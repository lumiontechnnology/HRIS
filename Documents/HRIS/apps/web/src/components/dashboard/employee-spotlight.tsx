'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import ClippedShapeGallery from '@/components/ui/clipped-shape-image';

interface RecentHire {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

interface RecentHiresResponse {
  data: RecentHire[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function EmployeeSpotlight(): JSX.Element {
  const { data } = useQuery({
    queryKey: ['employee-spotlight'],
    queryFn: async (): Promise<RecentHiresResponse> => {
      const response = await fetch('/api/employees/recent-hires', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load recent hires');
      }
      return (await response.json()) as RecentHiresResponse;
    },
    retry: 1,
  });

  const hires = useMemo(() => {
    if (!data?.data?.length) {
      return [];
    }

    return shuffle(data.data).slice(0, 3);
  }, [data?.data]);

  if (!hires.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Spotlight</CardTitle>
          <CardDescription>New hires this month</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No employee profiles are available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const mediaItems = hires.map((emp, index) => ({
    src: emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${emp.firstName} ${emp.lastName}`)}&background=1f2937&color=ffffff&size=512`,
    alt: `${emp.firstName} ${emp.lastName}`,
    clipId: (['clip-another1', 'clip-another2', 'clip-another3'] as const)[index] || 'clip-another1',
    type: 'image' as const,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Spotlight</CardTitle>
        <CardDescription>New hires this month</CardDescription>
      </CardHeader>
      <CardContent>
        <ClippedShapeGallery mediaItems={mediaItems} className="border-0 bg-transparent p-0" />
      </CardContent>
    </Card>
  );
}
