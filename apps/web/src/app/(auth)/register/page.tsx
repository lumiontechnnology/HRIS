'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@lumion/ui';
import { createClient } from '@/lib/supabase/client';

type RegisterForm = {
  companyName: string;
  industry: string;
  companySize: string;
  country: string;
  fullName: string;
  workEmail: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
};

const industries = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Retail', 'NGO', 'Government', 'Other'];
const sizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
const countries = ['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Other'];

export default function RegisterPage(): JSX.Element {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<RegisterForm>({
    companyName: '',
    industry: 'Technology',
    companySize: '11-50',
    country: 'Nigeria',
    fullName: '',
    workEmail: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });
  const router = useRouter();
  const supabase = createClient();

  const canMoveNext = useMemo(() => {
    if (step === 1) return form.companyName.trim().length > 1;
    if (step === 2) {
      return (
        form.fullName.trim().length > 1 &&
        form.workEmail.includes('@') &&
        form.password.length >= 8 &&
        /\d/.test(form.password) &&
        form.password === form.confirmPassword
      );
    }
    return form.agreedToTerms;
  }, [form, step]);

  async function createWorkspace() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || 'Registration failed');
      }

      // Sign in immediately so onboarding can proceed.
      const signIn = await supabase.auth.signInWithPassword({
        email: form.workEmail,
        password: form.password,
      });

      if (signIn.error) {
        router.push('/login');
        return;
      }

      router.push(payload.redirectTo || '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create your Lumion workspace</CardTitle>
          <CardDescription>This is for new companies. Employees do not self-register and are invited later.</CardDescription>
          <div className="mt-2 flex items-center gap-2">
            {[1, 2, 3].map((dot) => (
              <span key={dot} className={`h-2.5 w-2.5 rounded-full ${dot <= step ? 'bg-foreground' : 'bg-muted'}`} />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1 - Company</p>
              <label className="space-y-1.5 text-sm">
                <span>Company name (required)</span>
                <Input placeholder="Acme Ltd" value={form.companyName} onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Industry</span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.industry} onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}>
                {industries.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Company size</span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.companySize} onChange={(event) => setForm((prev) => ({ ...prev, companySize: event.target.value }))}>
                {sizes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Country</span>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}>
                {countries.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 2 - Your account (this person = SUPER_ADMIN)</p>
              <label className="space-y-1.5 text-sm">
                <span>Full name (required)</span>
                <Input placeholder="Jane Doe" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Work email (required)</span>
                <Input type="email" placeholder="jane@company.com" value={form.workEmail} onChange={(event) => setForm((prev) => ({ ...prev, workEmail: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Password</span>
                <Input type="password" placeholder="Minimum 8 characters" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Confirm password</span>
                <Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} />
              </label>
              <p className="text-xs text-muted-foreground">Password must be at least 8 characters and include one number.</p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 3 - Review + Submit</p>
              <div className="rounded-md border border-border p-4 text-sm">
                <p><strong>Company:</strong> {form.companyName}</p>
                <p><strong>Industry:</strong> {form.industry}</p>
                <p><strong>Size:</strong> {form.companySize}</p>
                <p><strong>Country:</strong> {form.country}</p>
                <p className="mt-2"><strong>Admin:</strong> {form.fullName} ({form.workEmail})</p>
              </div>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.agreedToTerms} onChange={(event) => setForm((prev) => ({ ...prev, agreedToTerms: event.target.checked }))} />
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep((prev) => Math.max(1, prev - 1))} disabled={step === 1 || submitting}>Back</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((prev) => Math.min(3, prev + 1))} disabled={!canMoveNext || submitting}>Next</Button>
            ) : (
              <Button onClick={createWorkspace} disabled={!canMoveNext || submitting}>{submitting ? 'Creating workspace...' : 'Create your workspace'}</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
