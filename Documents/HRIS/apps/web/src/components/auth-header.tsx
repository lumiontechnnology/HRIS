"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export function AuthHeader() {
  const { isSignedIn } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 bg-white border-b">
      <Link href="/" className="text-lg font-semibold hover:opacity-80 transition">
        Lumion HRIS
      </Link>
      <div className="flex gap-4">
        {!isSignedIn ? (
          <>
            <Link
              href="/auth/sign-in"
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Sign up
            </Link>
          </>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  );
}
