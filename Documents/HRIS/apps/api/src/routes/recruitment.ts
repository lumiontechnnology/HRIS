import { Hono } from 'hono';
import { z } from 'zod';
import { PrismaClient } from '@lumion/database';

const prisma = new PrismaClient();

// Schemas
const JobRequisitionSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  department: z.string().min(2),
  jobLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'EXECUTIVE']),
  salaryMin: z.number().min(0),
  salaryMax: z.number().min(0),
  currency: z.string().default('NGN'),
  numberOfPositions: z.number().int().min(1),
  closingDate: z.string().datetime(),
  status: z.enum(['OPEN', 'CLOSED', 'ON_HOLD']).optional(),
});

const ApplicationSchema = z.object({
  jobId: z.string().uuid(),
  candidateName: z.string().min(3),
  candidateEmail: z.string().email(),
  candidatePhone: z.string().min(10),
  resume: z.string().optional(),
  coverLetter: z.string().optional(),
  status: z.enum(['SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED']).optional(),
});

const InterviewSchema = z.object({
  applicationId: z.string().uuid(),
  round: z.enum(['PHONE', 'TECHNICAL', 'HR', 'FINAL']),
  scheduledDate: z.string().datetime(),
  interviewerName: z.string().min(2),
  meetingLink: z.string().url().optional(),
  notes: z.string().optional(),
  rating: z.number().min(1).max(10).optional(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
});

type JobRequisitionInput = z.infer<typeof JobRequisitionSchema>;
type ApplicationInput = z.infer<typeof ApplicationSchema>;
type InterviewInput = z.infer<typeof InterviewSchema>;

export function createRecruitmentRoutes(): Hono {
  const app = new Hono();

  // ============ JOB REQUISITIONS ============

  // List all job requisitions with filtering
  app.get('/jobs', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const status = c.req.query('status');
      const department = c.req.query('department');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const whereClause: Record<string, any> = { tenantId };
      if (status) whereClause.status = status;
      if (department) whereClause.department = { contains: department, mode: 'insensitive' };

      const [jobs, total] = await Promise.all([
        prisma.jobRequisition.findMany({
          where: whereClause,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { applications: true } },
          },
        }),
        prisma.jobRequisition.count({ where: whereClause }),
      ]);

      return c.json({
        success: true,
        data: jobs,
        meta: {
          page,
          limit,
          total,
          hasMore: (page - 1) * limit + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      return c.json(
        { success: false, error: { message: 'Failed to fetch job requisitions' } },
        500
      );
    }
  });

  // Get single job requisition with applications
  app.get('/jobs/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const job = await prisma.jobRequisition.findUnique({
        where: { id },
        include: {
          applications: {
            include: { interviews: true },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { applications: true } },
        },
      });

      if (!job || job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      return c.json({ success: true, data: job });
    } catch (error) {
      console.error('Error fetching job:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch job' } }, 500);
    }
  });

  // Create new job requisition
  app.post('/jobs', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const userId = c.req.header('x-user-id');

      if (!tenantId || !userId) {
        return c.json(
          { success: false, error: { message: 'Tenant and User ID required' } },
          400
        );
      }

      const body = await c.req.json();
      const validated = JobRequisitionSchema.parse(body);

      // Check if user exists and is HR/Admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: true } } },
      });

      if (!user) {
        return c.json({ success: false, error: { message: 'User not found' } }, 404);
      }

      const canCreateJobs = user.role?.permissions.some(
        (p) => p.resource === 'recruitment' && p.actions.includes('create')
      );

      if (!canCreateJobs) {
        return c.json(
          { success: false, error: { message: 'Insufficient permissions' } },
          403
        );
      }

      const job = await prisma.jobRequisition.create({
        data: {
          ...validated,
          tenantId,
          createdBy: userId,
          status: validated.status || 'OPEN',
        },
      });

      return c.json({ success: true, data: job }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { success: false, error: { message: 'Validation failed', details: error.errors } },
          400
        );
      }
      console.error('Error creating job:', error);
      return c.json({ success: false, error: { message: 'Failed to create job' } }, 500);
    }
  });

  // Update job requisition status
  app.patch('/jobs/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');
      const body = await c.req.json();

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const job = await prisma.jobRequisition.findUnique({ where: { id } });

      if (!job || job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      const updated = await prisma.jobRequisition.update({
        where: { id },
        data: { ...body },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating job:', error);
      return c.json({ success: false, error: { message: 'Failed to update job' } }, 500);
    }
  });

  // ============ APPLICATIONS ============

  // Get all applications with filtering
  app.get('/applications', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const jobId = c.req.query('jobId');
      const status = c.req.query('status');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const whereClause: Record<string, any> = {};
      if (jobId) whereClause.jobId = jobId;
      if (status) whereClause.status = status;

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where: {
            ...whereClause,
            job: { tenantId },
          },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            job: true,
            interviews: { orderBy: { scheduledDate: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.application.count({
          where: {
            ...whereClause,
            job: { tenantId },
          },
        }),
      ]);

      return c.json({
        success: true,
        data: applications,
        meta: {
          page,
          limit,
          total,
          hasMore: (page - 1) * limit + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching applications:', error);
      return c.json(
        { success: false, error: { message: 'Failed to fetch applications' } },
        500
      );
    }
  });

  // Get single application
  app.get('/applications/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const application = await prisma.application.findUnique({
        where: { id },
        include: {
          job: true,
          interviews: { orderBy: { scheduledDate: 'asc' } },
        },
      });

      if (!application || application.job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      return c.json({ success: true, data: application });
    } catch (error) {
      console.error('Error fetching application:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch application' } }, 500);
    }
  });

  // Create application (submit candidature)
  app.post('/applications', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const body = await c.req.json();
      const validated = ApplicationSchema.parse(body);

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      // Verify job exists and belongs to tenant
      const job = await prisma.jobRequisition.findUnique({
        where: { id: validated.jobId },
      });

      if (!job || job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      // Check if candidate already applied
      const existing = await prisma.application.findFirst({
        where: {
          jobId: validated.jobId,
          candidateEmail: validated.candidateEmail,
        },
      });

      if (existing) {
        return c.json(
          {
            success: false,
            error: { message: 'You have already applied for this position' },
          },
          400
        );
      }

      const application = await prisma.application.create({
        data: {
          ...validated,
          status: validated.status || 'SUBMITTED',
        },
        include: { job: true, interviews: true },
      });

      return c.json({ success: true, data: application }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { success: false, error: { message: 'Validation failed', details: error.errors } },
          400
        );
      }
      console.error('Error creating application:', error);
      return c.json({ success: false, error: { message: 'Failed to submit application' } }, 500);
    }
  });

  // Update application status
  app.patch('/applications/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');
      const body = await c.req.json();

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      // Verify application belongs to tenant
      const application = await prisma.application.findUnique({
        where: { id },
        include: { job: true },
      });

      if (!application || application.job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      const updated = await prisma.application.update({
        where: { id },
        data: body,
        include: { job: true, interviews: true },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating application:', error);
      return c.json({ success: false, error: { message: 'Failed to update application' } }, 500);
    }
  });

  // ============ INTERVIEWS ============

  // Get all interviews
  app.get('/interviews', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const status = c.req.query('status');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const whereClause: Record<string, any> = {};
      if (status) whereClause.status = status;

      const [interviews, total] = await Promise.all([
        prisma.interview.findMany({
          where: {
            ...whereClause,
            application: {
              job: { tenantId },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            application: {
              include: { job: true },
            },
          },
          orderBy: { scheduledDate: 'asc' },
        }),
        prisma.interview.count({
          where: {
            ...whereClause,
            application: {
              job: { tenantId },
            },
          },
        }),
      ]);

      return c.json({
        success: true,
        data: interviews,
        meta: {
          page,
          limit,
          total,
          hasMore: (page - 1) * limit + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching interviews:', error);
      return c.json(
        { success: false, error: { message: 'Failed to fetch interviews' } },
        500
      );
    }
  });

  // Get single interview
  app.get('/interviews/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const interview = await prisma.interview.findUnique({
        where: { id },
        include: {
          application: {
            include: { job: true },
          },
        },
      });

      if (!interview || interview.application.job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Interview not found' } }, 404);
      }

      return c.json({ success: true, data: interview });
    } catch (error) {
      console.error('Error fetching interview:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch interview' } }, 500);
    }
  });

  // Schedule interview
  app.post('/interviews', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const body = await c.req.json();
      const validated = InterviewSchema.parse(body);

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      // Verify application exists and belongs to tenant
      const application = await prisma.application.findUnique({
        where: { id: validated.applicationId },
        include: { job: true },
      });

      if (!application || application.job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      const interview = await prisma.interview.create({
        data: {
          ...validated,
          status: validated.status || 'SCHEDULED',
        },
        include: {
          application: {
            include: { job: true },
          },
        },
      });

      return c.json({ success: true, data: interview }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          { success: false, error: { message: 'Validation failed', details: error.errors } },
          400
        );
      }
      console.error('Error scheduling interview:', error);
      return c.json({ success: false, error: { message: 'Failed to schedule interview' } }, 500);
    }
  });

  // Update interview (record feedback/rating)
  app.patch('/interviews/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const tenantId = c.req.header('x-tenant-id');
      const body = await c.req.json();

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      // Verify interview belongs to tenant
      const interview = await prisma.interview.findUnique({
        where: { id },
        include: {
          application: {
            include: { job: true },
          },
        },
      });

      if (!interview || interview.application.job.tenantId !== tenantId) {
        return c.json({ success: false, error: { message: 'Interview not found' } }, 404);
      }

      const updated = await prisma.interview.update({
        where: { id },
        data: body,
        include: {
          application: {
            include: { job: true },
          },
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating interview:', error);
      return c.json({ success: false, error: { message: 'Failed to update interview' } }, 500);
    }
  });

  // ============ RECRUITMENT DASHBOARD ============

  // Get recruitment summary/KPIs
  app.get('/summary', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const [openPositions, totalApplications, shortlisted, rejected, scheduled] = await Promise.all(
        [
          prisma.jobRequisition.count({
            where: { tenantId, status: 'OPEN' },
          }),
          prisma.application.count({
            where: { job: { tenantId } },
          }),
          prisma.application.count({
            where: { job: { tenantId }, status: 'SHORTLISTED' },
          }),
          prisma.application.count({
            where: { job: { tenantId }, status: 'REJECTED' },
          }),
          prisma.interview.count({
            where: {
              status: 'SCHEDULED',
              application: { job: { tenantId } },
            },
          }),
        ]
      );

      return c.json({
        success: true,
        data: {
          openPositions,
          totalApplications,
          shortlisted,
          rejected,
          scheduledInterviews: scheduled,
          conversionRate: totalApplications > 0 ? ((shortlisted / totalApplications) * 100).toFixed(1) : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch summary' } }, 500);
    }
  });

  return app;
}
