'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useCurrentUser } from '@/lib/client-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, useToast } from '@lumion/ui';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: { title: string };
    email: string;
  };
  leaveType: {
    name: string;
    color: string;
  };
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string;
  status: string;
}

export default function LeaveApprovalsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const router = useRouter();
  const [approving, setApproving] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leave-requests-pending'],
    queryFn: async () => {
      const res = await fetch(
        '/api/proxy/leave-requests?status=SUBMITTED',
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch pending requests');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const handleApprove = async (requestId: string) => {
    setApproving(requestId);
    try {
      const res = await fetch(
        `/api/proxy/leave-requests/${requestId}/approve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
          body: JSON.stringify({
            status: 'APPROVED',
            approverComment: 'Approved by manager',
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to approve request');
      }

      toast({
        title: 'Success',
        description: 'Leave request approved',
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve request',
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setApproving(requestId);
    try {
      const res = await fetch(
        `/api/proxy/leave-requests/${requestId}/approve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
          body: JSON.stringify({
            status: 'REJECTED',
            approverComment: 'Rejected by manager',
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Failed to reject request');
      }

      toast({
        title: 'Success',
        description: 'Leave request rejected',
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reject request',
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  };

  const pendingRequests = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leave Approvals</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Review and approve pending leave requests from your team.
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            {pendingRequests.length} request{pendingRequests.length !== 1 ? 's' : ''} awaiting approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              Failed to load pending requests.
            </div>
          ) : pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map((request: LeaveRequest) => {
                const startDate = new Date(request.startDate);
                const endDate = new Date(request.endDate);

                return (
                  <div
                    key={request.id}
                    className="border border-slate-200 rounded-lg p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {request.employee.firstName} {request.employee.lastName}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {request.employee.jobTitle.title} • {request.employee.email}
                        </p>
                        <div className="mt-3 space-y-1 text-sm">
                          <p>
                            <span className="font-medium">Type:</span> {request.leaveType.name}
                          </p>
                          <p>
                            <span className="font-medium">Dates:</span> {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                          </p>
                          <p>
                            <span className="font-medium">Days:</span> {request.daysRequested}
                          </p>
                          {request.reason && (
                            <p>
                              <span className="font-medium">Reason:</span> {request.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request.id)}
                          disabled={approving === request.id}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={approving === request.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No pending requests</p>
              <p className="mt-2 text-sm text-slate-500">Great job staying on top of approvals!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
