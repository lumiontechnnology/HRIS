import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | Lumion HRIS',
};

export default function LoginPage(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-md">
          <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
          <p className="mt-2 text-slate-600">Login to Lumion HRIS</p>
          {/* Auth form will be implemented here */}
        </div>
      </div>
    </div>
  );
}
