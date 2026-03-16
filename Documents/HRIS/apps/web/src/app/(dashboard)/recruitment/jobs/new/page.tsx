'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/client-auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  useToast,
} from '@lumion/ui';

const JobRequisitionSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  department: z.string().min(2, 'Department is required'),
  jobLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'EXECUTIVE']),
  salaryMin: z.number().min(0),
  salaryMax: z.number().min(0),
  numberOfPositions: z.number().int().min(1),
  closingDate: z.string(),
});

type JobRequisitionInput = z.infer<typeof JobRequisitionSchema>;

export default function NewJobPage(): JSX.Element {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobRequisitionInput>({
    resolver: zodResolver(JobRequisitionSchema),
  });

  const onSubmit = async (data: JobRequisitionInput) => {
    setLoading(true);
    try {
      const payload = {
        title: data.title,
        description: data.description,
        department: data.department,
        jobLevel: data.jobLevel,
        salaryMin: parseInt(data.salaryMin.toString()),
        salaryMax: parseInt(data.salaryMax.toString()),
        numberOfPositions: data.numberOfPositions,
        closingDate: new Date(data.closingDate).toISOString(),
      };

      const res = await fetch('http://localhost:3001/api/v1/recruitment/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-tenant-id': user?.tenantId || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to create job');
      }

      const result = await res.json();

      toast({
        title: 'Success',
        description: 'Job requisition posted successfully',
      });

      router.push(`/dashboard/recruitment/jobs/${result.data.id}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create job',
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Post New Job</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Create a new job requisition to attract candidates.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
              <CardDescription>Basic details about the position</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input
                  {...register('title')}
                  id="title"
                  placeholder="e.g. Senior Software Engineer"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  {...register('description')}
                  id="description"
                  placeholder="Job description, responsibilities, and requirements"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  rows={6}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    {...register('department')}
                    id="department"
                    placeholder="e.g. Engineering"
                  />
                  {errors.department && (
                    <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="jobLevel">Job Level</Label>
                  <select
                    {...register('jobLevel')}
                    id="jobLevel"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="ENTRY">Entry Level</option>
                    <option value="MID">Mid Level</option>
                    <option value="SENIOR">Senior</option>
                    <option value="LEAD">Lead</option>
                    <option value="MANAGER">Manager</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                  {errors.jobLevel && (
                    <p className="mt-1 text-sm text-red-600">{errors.jobLevel.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salary & Positions */}
          <Card>
            <CardHeader>
              <CardTitle>Compensation & Positions</CardTitle>
              <CardDescription>Salary range and number of openings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="salaryMin">Minimum Salary (₦)</Label>
                  <Input
                    {...register('salaryMin', { valueAsNumber: true })}
                    id="salaryMin"
                    type="number"
                    placeholder="Min salary"
                  />
                  {errors.salaryMin && (
                    <p className="mt-1 text-sm text-red-600">{errors.salaryMin.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="salaryMax">Maximum Salary (₦)</Label>
                  <Input
                    {...register('salaryMax', { valueAsNumber: true })}
                    id="salaryMax"
                    type="number"
                    placeholder="Max salary"
                  />
                  {errors.salaryMax && (
                    <p className="mt-1 text-sm text-red-600">{errors.salaryMax.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="numberOfPositions">Number of Positions</Label>
                  <Input
                    {...register('numberOfPositions', { valueAsNumber: true })}
                    id="numberOfPositions"
                    type="number"
                    min="1"
                    placeholder="Number of positions"
                  />
                  {errors.numberOfPositions && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.numberOfPositions.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closing Date */}
          <Card>
            <CardHeader>
              <CardTitle>Application Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="closingDate">Application Closing Date</Label>
                <Input
                  {...register('closingDate')}
                  id="closingDate"
                  type="date"
                />
                {errors.closingDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.closingDate.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Posting...' : 'Post Job'}
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
