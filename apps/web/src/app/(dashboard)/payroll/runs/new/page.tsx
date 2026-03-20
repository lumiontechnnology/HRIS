'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  useToast,
} from '@lumion/ui';

const PayrollRunSchema = z.object({
  payScheduleId: z.string().uuid('Invalid schedule'),
  periodStart: z.string(),
  periodEnd: z.string(),
  dueDate: z.string(),
  description: z.string().optional(),
});

type PayrollRunInput = z.infer<typeof PayrollRunSchema>;

export default function NewPayrollRunPage(): JSX.Element {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PayrollRunInput>({
    resolver: zodResolver(PayrollRunSchema),
  });

  const onSubmit = async (data: PayrollRunInput) => {
    setLoading(true);
    try {
      const payload = {
        payScheduleId: data.payScheduleId,
        periodStart: new Date(data.periodStart).toISOString(),
        periodEnd: new Date(data.periodEnd).toISOString(),
        dueDate: new Date(data.dueDate).toISOString(),
        description: data.description,
      };

      const res = await fetch('/api/proxy/payroll/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to create payroll run');
      }

      const result = await res.json();

      toast({
        title: 'Success',
        description: 'Payroll run created successfully',
      });

      router.push(`/payroll/runs/${result.data.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create payroll run',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Create Payroll Run</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Set up a new payroll cycle for salary processing.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Payroll Run Details</CardTitle>
            <CardDescription>Configure the payroll cycle dates and schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pay Schedule */}
            <div>
              <Label htmlFor="payScheduleId">Pay Schedule</Label>
              <Input
                {...register('payScheduleId')}
                id="payScheduleId"
                placeholder="UUID of pay schedule (Monthly, Biweekly, etc.)"
              />
              {errors.payScheduleId && (
                <p className="mt-1 text-sm text-red-600">{errors.payScheduleId.message}</p>
              )}
            </div>

            {/* Period Dates */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  {...register('periodStart')}
                  id="periodStart"
                  type="date"
                />
                {errors.periodStart && (
                  <p className="mt-1 text-sm text-red-600">{errors.periodStart.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  {...register('periodEnd')}
                  id="periodEnd"
                  type="date"
                />
                {errors.periodEnd && (
                  <p className="mt-1 text-sm text-red-600">{errors.periodEnd.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dueDate">Payment Due Date</Label>
                <Input
                  {...register('dueDate')}
                  id="dueDate"
                  type="date"
                />
                {errors.dueDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                {...register('description')}
                id="description"
                placeholder="e.g. March 2026 Payroll"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Create Payroll Run'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
