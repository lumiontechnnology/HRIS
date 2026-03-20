'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useCurrentUser, useRequireAuth } from '@/lib/client-auth';
import { Toaster } from '@lumion/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({
  children,
}: DashboardLayoutProps): JSX.Element {
  const { isLoading } = useRequireAuth();
  const { user, isRoleResolved } = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();

  const { data: onboardingState } = useQuery({
    queryKey: ['onboarding-check', user?.tenantId],
    enabled: !!user && isRoleResolved && (user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'),
    queryFn: async () => {
      const res = await fetch('/api/auth/onboarding/state', { cache: 'no-store' });
      if (!res.ok) return null;
      const payload = await res.json();
      return payload?.data ?? null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user || !isRoleResolved) return;

    if (pathname === '/' && user.role === 'EMPLOYEE') {
      router.replace('/my-dashboard');
      return;
    }

    if (pathname === '/' && user.role === 'MANAGER') {
      router.replace('/manager-dashboard');
      return;
    }

    // Redirect SUPER_ADMIN to onboarding if not complete
    if (
      user.role === 'SUPER_ADMIN' &&
      onboardingState &&
      !onboardingState.tenant?.onboardingComplete &&
      pathname !== '/onboarding'
    ) {
      router.replace('/onboarding');
    }
  }, [isRoleResolved, pathname, router, user, onboardingState]);

  if (isLoading || !isRoleResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background animate-fade-in">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 px-6 py-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
