"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";

export function AuthHeader() {
  const { isSignedIn } = useAuth();

  return (
    <header className="flex items-center justify-between p-4 bg-white border-b">
      <div className="text-lg font-semibold">Lumion HRIS</div>
      <div className="flex gap-4">
        {!isSignedIn ? (
          <>
            <SignInButton mode="modal" />
            <SignUpButton mode="modal" />
          </>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  );
}
