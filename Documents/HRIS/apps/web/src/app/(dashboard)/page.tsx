'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import { Users, Calendar, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: { title: string };
  department?: { name: string };
  location?: { name: string };
  employmentStatus: string;
  hireDate: string;
  avatar?: string;
}

interface DashboardData {
  employees: Employee[];
  stats: {
    totalHeadcount: number;
    activeLeavePending: number;
    pendingPayroll: number;
    attritionRate: number;
  };
}

export default function DashboardPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/dashboard');
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = data?.stats || {
    totalHeadcount: 0,
    activeLeavePending: 0,
    pendingPayroll: 0,
    attritionRate: 0,
  };

  const employees = data?.employees || [];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Here's what's happening with your company today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Headcount</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats.totalHeadcount}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leave Pending</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats.activeLeavePending}</div>
            <p className="text-xs text-muted-foreground">Requests to approve</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{isLoading ? '-' : stats.pendingPayroll}M</div>
            <p className="text-xs text-muted-foreground">Due in 3 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attrition Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : stats.attritionRate}%</div>
            <p className="text-xs text-muted-foreground">Year over year</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Employees List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Recent employees and their information</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">No employees found. Complete your onboarding to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {employees.map(emp => (
                <div key={emp.id} className="flex gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                    {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {emp.jobTitle?.title || 'Position not set'} • {emp.department?.name || 'Department not set'}
                    </p>
                    <p className="text-xs text-slate-500">{emp.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">ID: {emp.employeeId}</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                      emp.employmentStatus === 'ACTIVE'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {emp.employmentStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
