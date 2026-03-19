'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type ColumnDef } from '@/components/system/data-table';
import { Badge, CardSkeleton, SectionHeader } from '@/components/system/primitives';
import { TeamSwiper } from '@/components/employees/team-swiper';
import { CsvImportDialog } from '@/components/employees/csv-import';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import { useCurrentUser } from '@/lib/client-auth';

interface EmployeeRow {
  id: string;
  name: string;
  employeeId: string;
  avatar?: string | null;
  department: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Probation';
  manager: string;
  location: 'Lagos' | 'Abuja' | 'Remote';
}

interface EmployeesApiResponse {
  data: Array<{
    id: string;
    employeeId: string;
    avatar?: string | null;
    firstName: string;
    lastName: string;
    department?: { name?: string | null } | null;
    jobTitle?: { title?: string | null } | null;
    employmentStatus?: string | null;
    manager?: { firstName?: string | null; lastName?: string | null } | null;
    location?: { name?: string | null } | null;
  }>;
}

function mapStatus(value: string | null | undefined): EmployeeRow['status'] {
  if (!value) return 'Probation';
  if (value === 'ACTIVE') return 'Active';
  if (value === 'ON_LEAVE') return 'On Leave';
  return 'Probation';
}

export default function EmployeesPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ui-employees', user?.id, user?.tenantId],
    enabled: !!user?.tenantId,
    queryFn: async () => {
      const response = await fetchDashboardApi<EmployeesApiResponse>(
        '/api/v1/employees?limit=200',
        user ? { id: user.id, tenantId: user.tenantId } : undefined
      );

      const mapped: EmployeeRow[] = response.data.map((item) => {
        const managerName = item.manager
          ? `${item.manager.firstName ?? ''} ${item.manager.lastName ?? ''}`.trim()
          : 'Executive Board';

        return {
          id: item.id,
          name: `${item.firstName} ${item.lastName}`.trim(),
          employeeId: item.employeeId,
          avatar: item.avatar,
          department: item.department?.name || 'Unassigned',
          role: item.jobTitle?.title || 'Not Assigned',
          status: mapStatus(item.employmentStatus),
          manager: managerName || 'Executive Board',
          location: (item.location?.name as EmployeeRow['location']) || 'Remote',
        };
      });

      return mapped;
    },
  });

  const effectiveRows = data ?? [];

  const filteredRows = useMemo(() => {
    return effectiveRows.filter((row) => {
      const byDept = departmentFilter === 'all' ? true : row.department === departmentFilter;
      const byStatus = statusFilter === 'all' ? true : row.status === statusFilter;
      const byLocation = locationFilter === 'all' ? true : row.location === locationFilter;
      return byDept && byStatus && byLocation;
    });
  }, [departmentFilter, effectiveRows, locationFilter, statusFilter]);

  const mobileImageUrls = filteredRows
    .slice(0, 8)
    .map((row) => row.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop');

  const columns: ColumnDef<EmployeeRow>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">{row.employeeId}</p>
        </div>
      ),
    },
    { key: 'employeeId', label: 'Employee ID', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge tone={row.status === 'Active' ? 'success' : row.status === 'On Leave' ? 'warning' : 'info'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'manager', label: 'Manager', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Employees"
        description="Search and manage workforce records with operational filters."
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/employees/export?format=csv`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors duration-150 hover:bg-muted"
            >
              Export CSV
            </a>

            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              Import CSV
            </Button>

            <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Employee</DialogTitle>
                <DialogDescription>Create an employee shell and complete profile details later.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="First Name" />
                <Input placeholder="Last Name" />
                <Input placeholder="Work Email" />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    toast({ title: 'Employee created', description: 'Employee shell has been added to onboarding queue.' });
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        }
      />

      <CsvImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Department, status, and location filters</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
              <SelectItem value="Human Resources">Human Resources</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="On Leave">On Leave</SelectItem>
              <SelectItem value="Probation">Probation</SelectItem>
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Lagos">Lagos</SelectItem>
              <SelectItem value="Abuja">Abuja</SelectItem>
              <SelectItem value="Remote">Remote</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>Row click opens employee profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 md:hidden">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Meet The Team</p>
            <TeamSwiper imageUrls={mobileImageUrls} />
          </div>

          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <DataTable
              rows={filteredRows}
              columns={columns}
              searchKeys={['name', 'employeeId', 'department', 'role', 'manager', 'location']}
              searchPlaceholder="Search name, ID, department or manager"
              emptyTitle="No employees matched"
              emptyDescription="Adjust filters or search terms to find employee records."
              onRowClick={(row) => router.push(`/employees/${row.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
