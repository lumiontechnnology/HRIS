'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LeaveRequestCreateSchema } from '@lumion/validators';
import type { LeaveRequestCreateInput } from '@lumion/validators';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@lumion/ui';

interface LeaveType {
  id: string;
  name: string;
  color: string;
  allowancePerYear: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

export default function NewLeaveRequestPage(): JSX.Element {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LeaveRequestCreateInput>({
    resolver: zodResolver(LeaveRequestCreateSchema),
  });

  // Fetch leave types
  const { data: leaveTypesData } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/v1/leave-requests/types/list', {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch leave types');
      }

      return res.json();
    },
    enabled: !!user,
  });

  // Fetch leave balance
  const { data: balanceData } = useQuery({
    queryKey: ['leave-balance', selectedEmployeeId, selectedLeaveTypeId],
    queryFn: async () => {
      if (!selectedEmployeeId || !selectedLeaveTypeId) return null;

      const res = await fetch(
        `http://localhost:3001/api/v1/leave-requests/employee/${selectedEmployeeId}/balance`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        return null;
      }

      return res.json();
    },
    enabled: !!user && !!selectedEmployeeId,
  });

  const leaveTypes = leaveTypesData?.data || [];
  const selectedLeaveType = leaveTypes.find((lt: LeaveType) => lt.id === selectedLeaveTypeId);

  let availableDays = 0;
  if (balanceData?.data && selectedLeaveTypeId) {
    const balance = balanceData.data.find((b: any) => b.leaveTypeId === selectedLeaveTypeId);
    availableDays = balance?.available || 0;
  }

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  let daysCount = 0;
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  const onSubmit = async (data: LeaveRequestCreateInput) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to create leave request');
      }

      toast({
        title: 'Success',
        description: 'Leave request submitted for approval',
      });

      router.push('/leave');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create leave request',
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Request Leave</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Submit a new leave request for approval.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Leave Request Details</CardTitle>
            <CardDescription>Fill in the details for your leave request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Leave Type */}
            <div>
              <Label htmlFor="leaveTypeId">Leave Type</Label>
              <Select
                value={selectedLeaveTypeId}
                onValueChange={(value) => {
                  setSelectedLeaveTypeId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type: LeaveType) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.allowancePerYear} days/year)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLeaveTypeId && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Available days: <span className="font-semibold">{availableDays}</span>
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  {...register('startDate')}
                  id="startDate"
                  type="date"
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  {...register('endDate')}
                  id="endDate"
                  type="date"
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            {daysCount > 0 && (
              <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/20">
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
                  Total days requested: <span className="text-lg font-bold">{daysCount}</span>
                </p>
                {daysCount > availableDays && availableDays > 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    ⚠️ You only have {availableDays} days available
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <Label htmlFor="reason">Reason for Leave</Label>
              <Input
                {...register('reason')}
                id="reason"
                placeholder="e.g. Personal, Medical, Vacation"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading || daysCount === 0 || daysCount > availableDays}
                className="flex-1"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
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
