'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { useCurrentUser, useRequireAuth } from '@/lib/client-auth';
import { Toaster } from '@lumion/ui';
import { usePathname, useRouter } from 'next/navigation';

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

  useEffect(() => {
    if (!user || !isRoleResolved) return;

    if (pathname === '/' && user.role === 'EMPLOYEE') {
      router.replace('/my-dashboard');
      return;
    }

    if (pathname === '/' && user.role === 'MANAGER') {
      router.replace('/manager-dashboard');
    }
  }, [isRoleResolved, pathname, router, user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
          <p className="mt-4 text-slate-600">Loading...</p>
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
