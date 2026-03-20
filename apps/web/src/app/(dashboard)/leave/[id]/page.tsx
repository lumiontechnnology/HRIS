'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Clock, XCircle } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee: {
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: { title: string };
    department: { name: string };
    manager?: { firstName: string; lastName: string };
  };
  leaveType: {
    name: string;
    color: string;
    allowancePerYear: number;
  };
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  managerApprovedAt?: string;
  approvedByManager?: { firstName: string; lastName: string };
  managerComment?: string;
  createdAt: string;
}

const statusConfig = {
  SUBMITTED: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
};

export default function LeaveDetailPage(): JSX.Element {
  const params = useParams();
  const id = params.id as string;
  const { user } = useCurrentUser();

  const { data, isLoading, error } = useQuery({
    queryKey: ['leave-request', id],
    queryFn: async () => {
      const res = await fetch(`/api/proxy/leave-requests/${id}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch leave request');
      }

      return res.json();
    },
    enabled: !!user && !!id,
  });

  const request = data?.data as LeaveRequest | undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-6">
        <Link href="/leave">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Failed to load leave request.
        </div>
      </div>
    );
  }

  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);
  const createdDate = new Date(request.createdAt);
  const Config = statusConfig[request.status];
  const Icon = Config.icon;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/leave">
        <Button variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {request.employee.firstName} {request.employee.lastName}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Leave Request • Submitted on {createdDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 dark:border-slate-800">
          <Icon className="h-5 w-5" />
          <span className="font-semibold">{Config.label}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Details */}
        <div className="md:col-span-2 space-y-6">
          {/* Employee Info */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Employee ID</p>
                  <p className="font-semibold">{request.employee.employeeId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
                  <p className="font-semibold">{request.employee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Position</p>
                  <p className="font-semibold">{request.employee.jobTitle.title}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Department</p>
                  <p className="font-semibold">{request.employee.department.name}</p>
                </div>
              </div>
              {request.employee.manager && (
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Manager</p>
                  <p className="font-semibold">
                    {request.employee.manager.firstName} {request.employee.manager.lastName}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Details */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Leave Type</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: request.leaveType.color }}
                    />
                    <p className="font-semibold">{request.leaveType.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Days Requested</p>
                  <p className="text-2xl font-bold text-indigo-600">{request.daysRequested}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Duration</p>
                <p className="font-semibold">
                  {startDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  to{' '}
                  {endDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {request.reason && (
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Reason</p>
                  <p className="font-semibold">{request.reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval Status */}
          {request.status !== 'SUBMITTED' && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {request.status === 'APPROVED' ? 'Approval Details' : 'Rejection Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} By
                  </p>
                  <p className="font-semibold">
                    {request.approvedByManager?.firstName} {request.approvedByManager?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {request.status === 'APPROVED' ? 'Approval' : 'Rejection'} Date
                  </p>
                  <p className="font-semibold">
                    {request.managerApprovedAt
                      ? new Date(request.managerApprovedAt).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
                {request.managerComment && (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Comment</p>
                    <p className="font-semibold">{request.managerComment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`rounded-lg p-3 text-center ${Config.color}`}>
                <p className="font-semibold">{Config.label}</p>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                  Submitted
                </p>
                <p className="mt-1 font-semibold">{createdDate.toLocaleDateString()}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {createdDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {request.managerApprovedAt && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </p>
                  <p className="mt-1 font-semibold">
                    {new Date(request.managerApprovedAt).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(request.managerApprovedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
