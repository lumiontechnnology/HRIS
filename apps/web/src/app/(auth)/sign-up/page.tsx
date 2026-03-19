'use client';

import Link from 'next/link';

export default function SignUpPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
        <h1 className="font-display text-3xl font-normal text-card-foreground">Access managed by HR</h1>
        <p className="text-sm text-muted-foreground">
          Self-service sign up is disabled for Lumion HRIS. Contact your HR administrator to create your account.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/register"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Register company
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
