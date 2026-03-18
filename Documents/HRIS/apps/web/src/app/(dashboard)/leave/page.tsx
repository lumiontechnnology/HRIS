'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@lumion/ui';
import { CalendarDays, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

interface ApprovalRow {
  id: string;
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'Submitted' | 'Approved' | 'Rejected';
}

interface LeaveRequestsResponse {
  data: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    leaveType?: { name?: string | null } | null;
    employee?: { firstName?: string | null; lastName?: string | null } | null;
  }>;
}

function mapLeaveStatus(value: string): ApprovalRow['status'] {
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  return 'Submitted';
}

export default function LeavePage(): JSX.Element {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [month] = useState('March 2026');
  const [leaveType, setLeaveType] = useState('annual');

  const { data, isLoading } = useQuery({
    queryKey: ['ui-leave-requests', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const response = await fetchDashboardApi<LeaveRequestsResponse>(
        '/api/v1/leave-requests?limit=100',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );

      const mapped: ApprovalRow[] = response.data.map((item) => ({
        id: item.id,
        employee: `${item.employee?.firstName ?? ''} ${item.employee?.lastName ?? ''}`.trim() || 'Unknown Employee',
        leaveType: item.leaveType?.name || 'Leave',
        startDate: item.startDate,
        endDate: item.endDate,
        status: mapLeaveStatus(item.status),
      }));

      return mapped;
    },
  });

  const approvals = data ?? [];

  const dayCells = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        day: index + 1,
        state: index === 20 || index === 21 ? 'request' : index === 16 ? 'holiday' : 'normal',
      })),
    []
  );

  const columns: ColumnDef<ApprovalRow>[] = [
    { key: 'employee', label: 'Employee', sortable: true },
    { key: 'leaveType', label: 'Leave Type', sortable: true },
    { key: 'startDate', label: 'Start Date', sortable: true },
    { key: 'endDate', label: 'End Date', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge tone={row.status === 'Approved' ? 'success' : row.status === 'Rejected' ? 'danger' : 'warning'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  const annualCount = approvals.filter((item) => item.leaveType.toLowerCase().includes('annual')).length;
  const pendingCount = approvals.filter((item) => item.status === 'Submitted').length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Leave Management"
        description="Balance tracking, request creation, and approval operations in one workspace."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Annual Leave Requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{annualCount}</p>
            <p className="text-xs text-slate-500">Across current data window</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Approval</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingCount}</p>
            <p className="text-xs text-slate-500">Awaiting action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approval Throughput</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{Math.max(0, approvals.length - pendingCount)}</p>
            <p className="text-xs text-slate-500">Processed requests</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </CardTitle>
            <CardDescription>{month}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-600">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <p key={day} className="py-1 font-semibold">{day}</p>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {dayCells.map((cell) => (
                <div
                  key={cell.day}
                  className={`rounded border p-2 text-center text-sm ${
                    cell.state === 'request'
                      ? 'border-amber-300 bg-amber-50'
                      : cell.state === 'holiday'
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  {cell.day}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Leave</CardTitle>
            <CardDescription>Submit new leave request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue placeholder="Leave Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual Leave</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="maternity">Maternity Leave</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" />
            <Input type="date" />
            <Input placeholder="Reason" />
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  Submit Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Leave Request</DialogTitle>
                  <DialogDescription>Submit this leave request to approval queue?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      toast({ title: 'Request submitted', description: 'Leave request has been queued for approval.' });
                    }}
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>Filter, sort, and process pending leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <DataTable
              rows={approvals}
              columns={columns}
              searchKeys={['employee', 'leaveType', 'status', 'id']}
              searchPlaceholder="Search employee, type or request ID"
              emptyTitle="No leave requests"
              emptyDescription="All caught up. New requests will appear here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
