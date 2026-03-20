'use client';

import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/lib/client-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LeaveBalance {
  id: string;
  leaveType: {
    name: string;
    color: string;
    allowancePerYear: number;
  };
  available: number;
  used: number;
  year: number;
}

export default function LeaveBalancePage(): JSX.Element {
  const { user } = useCurrentUser();

  // Fetch current user's employee record
  const { data: employeeData } = useQuery({
    queryKey: ['current-employee'],
    queryFn: async () => {
      const res = await fetch(`/api/proxy/employees?limit=1000`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch employees');
      }

      const data = await res.json();
      // In a real app, filter by userId from employee record
      return data.data?.[0];
    },
    enabled: !!user,
  });

  // Fetch leave balance
  const { data: balanceData, isLoading } = useQuery({
    queryKey: ['leave-balance', employeeData?.id],
    queryFn: async () => {
      if (!employeeData?.id) return null;

      const res = await fetch(
        `/api/proxy/leave-requests/employee/${employeeData.id}/balance`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch leave balance');
      }

      return res.json();
    },
    enabled: !!user && !!employeeData?.id,
  });

  const balances = balanceData?.data || [];

  const chartData = balances.map((balance: LeaveBalance) => ({
    name: balance.leaveType.name,
    used: balance.used,
    available: balance.available,
  }));

  const totalAllowance = balances.reduce((sum: number, b: LeaveBalance) => sum + b.leaveType.allowancePerYear, 0);
  const totalUsed = balances.reduce((sum: number, b: LeaveBalance) => sum + b.used, 0);
  const totalAvailable = balances.reduce((sum: number, b: LeaveBalance) => sum + b.available, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Leave Balance</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          View your available leave balance for the current year.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Allowance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalAllowance}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">days per year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Days Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{totalUsed}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {((totalUsed / totalAllowance) * 100).toFixed(0)}% of allowance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Days Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{totalAvailable}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">remaining balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Balance by Leave Type</CardTitle>
          <CardDescription>Breakdown of your leave balance across all types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : balances.length > 0 ? (
            <>
              <div className="space-y-4">
                {balances.map((balance: LeaveBalance) => (
                  <div
                    key={balance.id}
                    className="border border-slate-200 rounded-lg p-4 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: balance.leaveType.color }}
                        />
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {balance.leaveType.name}
                          </h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {balance.leaveType.allowancePerYear} days per year
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {balance.available} / {balance.leaveType.allowancePerYear} days
                        </p>
                        <div className="mt-2 h-2 w-32 rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${(balance.used / balance.leaveType.allowancePerYear) * 100}%`,
                              backgroundColor: balance.leaveType.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="mt-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="used" fill="#f59e0b" name="Used" />
                      <Bar dataKey="available" fill="#10b981" name="Available" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No leave balance found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
