'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/client-auth';
import { Plus, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: { title: string };
    department: { name: string };
  };
  leaveType: {
    name: string;
    color: string;
  };
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reason: string;
  createdAt: string;
}

const statusConfig = {
  SUBMITTED: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
};

export default function LeaveRequestsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['leave-requests', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (status) {
        params.append('status', status);
      }

      const res = await fetch(`http://localhost:3001/api/v1/leave-requests?${params}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch leave requests');
      }

      return res.json();
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leave Requests</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage and track leave requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/leave/balance">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              View Balance
            </Button>
          </Link>
          <Link href="/dashboard/leave/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Request Leave
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={status === '' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
            >
              All Requests
            </Button>
            <Button
              variant={status === 'SUBMITTED' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('SUBMITTED');
                setPage(1);
              }}
            >
              Pending
            </Button>
            <Button
              variant={status === 'APPROVED' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('APPROVED');
                setPage(1);
              }}
            >
              Approved
            </Button>
            <Button
              variant={status === 'REJECTED' ? 'default' : 'outline'}
              onClick={() => {
                setStatus('REJECTED');
                setPage(1);
              }}
            >
              Rejected
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>All leave requests in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              Failed to load leave requests. Make sure the API server is running on port 3001.
            </div>
          ) : data?.data && data.data.length > 0 ? (
            <div className="space-y-4">
              {data.data.map((request: LeaveRequest) => {
                const startDate = new Date(request.startDate);
                const endDate = new Date(request.endDate);
                const Config = statusConfig[request.status];
                const Icon = Config.icon;

                return (
                  <div
                    key={request.id}
                    className="border border-slate-200 rounded-lg p-4 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {request.employee.firstName} {request.employee.lastName}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${Config.color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {Config.label}
                          </span>
                          <span
                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor: request.leaveType.color + '20',
                              color: request.leaveType.color,
                            }}
                          >
                            {request.leaveType.name}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {request.employee.jobTitle.title} • {request.employee.department.name}
                        </p>
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Dates:</span> {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Days:</span> {request.daysRequested}
                        </p>
                        {request.reason && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-medium">Reason:</span> {request.reason}
                          </p>
                        )}
                      </div>
                      <Link href={`/dashboard/leave/${request.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No leave requests found</p>
            </div>
          )}

          {/* Pagination */}
          {data?.meta && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Page {data.meta.page} of {Math.ceil(data.meta.total / 20)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={!data.meta.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
