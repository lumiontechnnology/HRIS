'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@lumion/ui';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/client-auth';
import { Plus, Search } from 'lucide-react';
import { Input } from '@lumion/ui';

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: { title: string };
  department: { name: string };
  location: { name: string };
  employmentStatus: string;
  hireDate: string;
  avatar?: string;
}

export default function EmployeesPage(): JSX.Element {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (search) {
        params.append('search', search);
      }

      const res = await fetch(`http://localhost:3001/api/v1/employees?${params}`, {
        headers: {
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch employees');
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Employees</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Manage and view all employees in your organization.
          </p>
        </div>
        <Link href="/dashboard/employees/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
          <CardDescription>All employees in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              Failed to load employees. Make sure the API server is running on port 3001.
            </div>
          ) : data?.data && data.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="pb-3 text-left font-semibold">Employee ID</th>
                    <th className="pb-3 text-left font-semibold">Name</th>
                    <th className="pb-3 text-left font-semibold">Email</th>
                    <th className="pb-3 text-left font-semibold">Position</th>
                    <th className="pb-3 text-left font-semibold">Department</th>
                    <th className="pb-3 text-left font-semibold">Status</th>
                    <th className="pb-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((employee: Employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <td className="py-3">{employee.employeeId}</td>
                      <td className="py-3">
                        <Link
                          href={`/dashboard/employees/${employee.id}`}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {employee.firstName} {employee.lastName}
                        </Link>
                      </td>
                      <td className="py-3">{employee.email}</td>
                      <td className="py-3">{employee.jobTitle.title}</td>
                      <td className="py-3">{employee.department.name}</td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          {employee.employmentStatus}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link href={`/dashboard/employees/${employee.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">No employees found</p>
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
