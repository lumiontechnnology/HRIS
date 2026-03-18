'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function AuthHeader() {
  const supabase = createClient();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsSignedIn(!!user);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <header className="flex items-center justify-between border-b bg-white p-4">
      <Link href="/" className="text-lg font-semibold transition hover:opacity-80">
        Lumion HRIS
      </Link>
      <div className="flex gap-4">
        {!isSignedIn ? (
          <>
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Sign up
            </Link>
          </>
        ) : (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.assign('/sign-in');
            }}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
