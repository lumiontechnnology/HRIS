'use client';

import { useCurrentUser } from '@/lib/client-auth';
import { Search } from 'lucide-react';
import { Button, Input } from '@lumion/ui';

export function Header(): JSX.Element {
  const { user } = useCurrentUser();
  const today = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        <div className="relative hidden w-full max-w-sm md:block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search people, runs, reports" className="border-input bg-background pl-9" />
        </div>

        <div className="flex items-center gap-4">
          <p className="hidden text-xs uppercase tracking-widest text-muted-foreground md:block">{today}</p>
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-foreground">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" size="sm" className="hidden md:inline-flex">Quick actions</Button>
        </div>
      </div>
    </header>
  );
}
