'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmployeeCreateSchema } from '@lumion/validators';
import type { EmployeeCreateInput } from '@lumion/validators';
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

export default function NewEmployeePage(): JSX.Element {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeCreateInput>({
    resolver: zodResolver(EmployeeCreateSchema),
  });

  const onSubmit = async (data: EmployeeCreateInput) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/employees', {
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
        throw new Error(error.error?.message || 'Failed to create employee');
      }

      toast({
        title: 'Success',
        description: 'Employee created successfully',
      });

      router.push('/employees');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create employee',
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Add New Employee</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Fill in the employee details below.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Employee's basic personal data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    {...register('firstName')}
                    id="firstName"
                    placeholder="e.g. John"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    {...register('middleName')}
                    id="middleName"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    {...register('lastName')}
                    id="lastName"
                    placeholder="e.g. Okonkwo"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    {...register('email')}
                    id="email"
                    type="email"
                    placeholder="john@company.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    {...register('phone')}
                    id="phone"
                    placeholder="+234 800 000 0000"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    {...register('dateOfBirth')}
                    id="dateOfBirth"
                    type="date"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Employment Information</CardTitle>
              <CardDescription>Job and contract details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="hireDate">Hire Date</Label>
                  <Input
                    {...register('hireDate')}
                    id="hireDate"
                    type="date"
                  />
                  {errors.hireDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.hireDate.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select defaultValue="">
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME">Full Time</SelectItem>
                      <SelectItem value="PART_TIME">Part Time</SelectItem>
                      <SelectItem value="CONTRACT">Contract</SelectItem>
                      <SelectItem value="TEMPORARY">Temporary</SelectItem>
                      <SelectItem value="PROBATION">Probation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="salary">Monthly Salary (₦)</Label>
                  <Input
                    {...register('salary', { valueAsNumber: true })}
                    id="salary"
                    type="number"
                    placeholder="0"
                  />
                  {errors.salary && (
                    <p className="mt-1 text-sm text-red-600">{errors.salary.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="jobTitleId">Job Title</Label>
                  <Input
                    {...register('jobTitleId')}
                    id="jobTitleId"
                    placeholder="UUID of job title"
                  />
                  {errors.jobTitleId && (
                    <p className="mt-1 text-sm text-red-600">{errors.jobTitleId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="departmentId">Department</Label>
                  <Input
                    {...register('departmentId')}
                    id="departmentId"
                    placeholder="UUID of department"
                  />
                  {errors.departmentId && (
                    <p className="mt-1 text-sm text-red-600">{errors.departmentId.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="locationId">Location</Label>
                  <Input
                    {...register('locationId')}
                    id="locationId"
                    placeholder="UUID of location"
                  />
                  {errors.locationId && (
                    <p className="mt-1 text-sm text-red-600">{errors.locationId.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="md:col-span-2 flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Employee'}
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
        </div>
      </form>
    </div>
  );
}
