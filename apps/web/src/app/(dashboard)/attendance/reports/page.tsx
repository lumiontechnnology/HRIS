'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input } from '@lumion/ui';
import { useCurrentUser } from '@/lib/client-auth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface EmployeeReport {
  employee: {
    firstName: string;
    lastName: string;
    department: { name: string };
  };
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  totalHours: number;
  avgHours: number;
}

export default function AttendanceReportsPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Fetch report
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-report', month],
    queryFn: async () => {
      const res = await fetch(
        `/api/proxy/attendance/report/${month}`,
        {
          headers: {
            'x-user-id': user?.id || '',
            'x-tenant-id': user?.tenantId || '',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch report');
      }

      return res.json();
    },
    enabled: !!user,
  });

  const employees: EmployeeReport[] = data?.data || [];
  const summary = data?.summary;

  // Prepare chart data
  const chartData = employees.map((emp: EmployeeReport) => ({
    name: `${emp.employee.firstName.slice(0, 1)}${emp.employee.lastName.slice(0, 1)}`,
    present: emp.present,
    late: emp.late,
    absent: emp.absent,
    onLeave: emp.onLeave,
  }));

  const hoursChartData = employees.map((emp: EmployeeReport) => ({
    name: `${emp.employee.firstName.slice(0, 1)}${emp.employee.lastName.slice(0, 1)}`,
    totalHours: emp.totalHours,
    avgHours: emp.avgHours,
  }));

  const overallData = employees.reduce(
    (acc, emp: EmployeeReport) => ({
      present: acc.present + emp.present,
      late: acc.late + emp.late,
      absent: acc.absent + emp.absent,
      onLeave: acc.onLeave + emp.onLeave,
    }),
    { present: 0, late: 0, absent: 0, onLeave: 0 }
  );

  const overallChartData = [
    { name: 'Present', value: overallData.present, fill: '#10b981' },
    { name: 'Late', value: overallData.late, fill: '#f59e0b' },
    { name: 'Absent', value: overallData.absent, fill: '#ef4444' },
    { name: 'On Leave', value: overallData.onLeave, fill: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/attendance">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Attendance Reports</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Monthly attendance analytics and insights.
          </p>
        </div>
      </div>

      {/* Month Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div>
              <label htmlFor="month" className="block text-sm font-medium mb-2">
                Select Month
              </label>
              <Input
                id="month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.totalEmployees}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.totalRecords}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Average Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{summary.averageAttendance}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
        </div>
      ) : (
        <>
          {/* Overall Attendance Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Attendance Distribution</CardTitle>
              <CardDescription>Monthly breakdown by status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overallChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {overallChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Attendance by Employee */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance by Employee</CardTitle>
              <CardDescription>Status breakdown per employee</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" fill="#10b981" name="Present" />
                  <Bar dataKey="late" fill="#f59e0b" name="Late" />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                  <Bar dataKey="onLeave" fill="#3b82f6" name="On Leave" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Hours Worked */}
          <Card>
            <CardHeader>
              <CardTitle>Hours Worked by Employee</CardTitle>
              <CardDescription>Total and average hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hoursChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalHours" stroke="#3b82f6" name="Total Hours" />
                  <Line type="monotone" dataKey="avgHours" stroke="#8b5cf6" name="Avg Hours/Day" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Employee Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Details</CardTitle>
              <CardDescription>Individual attendance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="pb-3 text-left font-semibold">Employee</th>
                      <th className="pb-3 text-left font-semibold">Present</th>
                      <th className="pb-3 text-left font-semibold">Late</th>
                      <th className="pb-3 text-left font-semibold">Absent</th>
                      <th className="pb-3 text-left font-semibold">Leave</th>
                      <th className="pb-3 text-left font-semibold">Total Hours</th>
                      <th className="pb-3 text-left font-semibold">Avg Hours/Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp: EmployeeReport, idx: number) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <td className="py-3">
                          <div>
                            <p className="font-medium">
                              {emp.employee.firstName} {emp.employee.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {emp.employee.department.name}
                            </p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="inline-block rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                            {emp.present}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-block rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                            {emp.late}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-block rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-200">
                            {emp.absent}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                            {emp.onLeave}
                          </span>
                        </td>
                        <td className="py-3 font-semibold">
                          {emp.totalHours.toFixed(1)}h
                        </td>
                        <td className="py-3 font-semibold">
                          {emp.avgHours.toFixed(1)}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
