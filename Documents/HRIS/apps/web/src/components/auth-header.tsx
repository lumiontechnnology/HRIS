'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function AuthHeader() {
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);

  const shouldShowHeader = pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/login';

  useEffect(() => {
    if (!shouldShowHeader) {
      return;
    }

    let mounted = true;
    let subscription: { unsubscribe: () => void } | undefined;

    const bootstrap = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (mounted) {
          setIsSignedIn(!!user);
        }

        const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setIsSignedIn(!!session?.user);
          }
        });

        subscription = authSubscription.data.subscription;
      } catch (error) {
        console.error('Failed to initialize auth header:', error);
        if (mounted) {
          setIsSignedIn(false);
        }
      }
    };

    void bootstrap();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [shouldShowHeader]);

  if (!shouldShowHeader) {
    return null;
  }

  return (
    <header className="border-b border-border bg-background px-6 py-4">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between">
      <Link href="/" className="font-display text-2xl font-normal tracking-tight text-foreground transition-opacity hover:opacity-80">
        Lumion HRIS
      </Link>
      <div className="flex items-center gap-2">
        {!isSignedIn ? (
          <>
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity duration-150 hover:opacity-90"
            >
              Sign up
            </Link>
          </>
        ) : (
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.assign('/sign-in');
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
          >
            Sign out
          </button>
        )}
      </div>
      </div>
    </header>
  );
}
