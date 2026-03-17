import { ClerkLoaded, SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <Suspense fallback={<div>Loading sign in...</div>}>
        <ClerkLoaded>
          <SignIn />
        </ClerkLoaded>
      </Suspense>
    </div>
  );
}
