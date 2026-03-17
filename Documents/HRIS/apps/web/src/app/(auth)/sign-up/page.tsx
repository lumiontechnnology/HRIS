import { ClerkLoaded, SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <Suspense fallback={<div>Loading sign up...</div>}>
        <ClerkLoaded>
          <SignUp />
        </ClerkLoaded>
      </Suspense>
    </div>
  );
}
