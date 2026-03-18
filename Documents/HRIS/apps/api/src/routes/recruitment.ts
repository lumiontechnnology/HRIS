import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

const JobRequisitionSchema = z.object({
  jobTitleId: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  description: z.string().min(10),
  requirements: z.string().optional(),
  salary_min: z.number().nonnegative().optional(),
  salary_max: z.number().nonnegative().optional(),
  currency: z.string().min(3).default('NGN'),
  status: z.enum(['DRAFT', 'APPROVED', 'PUBLISHED', 'CLOSED', 'ARCHIVED']).optional(),
});

const ApplicationSchema = z.object({
  jobRequisitionId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().min(1),
  coverLetter: z.string().optional(),
  status: z
    .enum([
      'APPLIED',
      'SCREENING',
      'PHONE_INTERVIEW',
      'TECHNICAL_TEST',
      'PANEL_INTERVIEW',
      'OFFER',
      'HIRED',
      'REJECTED',
    ])
    .optional(),
  currentStage: z.string().optional(),
});

const InterviewSchema = z.object({
  applicationId: z.string().min(1),
  interviewerId: z.string().min(1).optional(),
  stage: z.enum(['PHONE_INTERVIEW', 'TECHNICAL_TEST', 'PANEL_INTERVIEW']),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  completedAt: z.string().datetime().optional(),
});

export function createRecruitmentRoutes(): Hono {
  const app = new Hono();

  app.get('/jobs', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const parsed = ListQuerySchema.parse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status'),
      });

      const where: { tenantId: string; status?: string } = { tenantId };
      if (parsed.status) where.status = parsed.status;

      const [jobs, total] = await Promise.all([
        prisma.jobRequisition.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            applications: {
              select: { id: true, status: true },
            },
          },
        }),
        prisma.jobRequisition.count({ where }),
      ]);

      return c.json({
        success: true,
        data: jobs,
        meta: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          hasMore: parsed.page * parsed.limit < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Invalid query', details: error.errors } }, 400);
      }
      console.error('Error fetching jobs:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch jobs' } }, 500);
    }
  });

  app.get('/jobs/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');

      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const job = await prisma.jobRequisition.findFirst({
        where: { id, tenantId },
        include: {
          applications: {
            orderBy: { createdAt: 'desc' },
            include: {
              interviews: { orderBy: { scheduledAt: 'asc' } },
            },
          },
        },
      });

      if (!job) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      return c.json({ success: true, data: job });
    } catch (error) {
      console.error('Error fetching job:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch job' } }, 500);
    }
  });

  app.post('/jobs', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const body = await c.req.json();
      const validated = JobRequisitionSchema.parse(body);

      const created = await prisma.jobRequisition.create({
        data: {
          tenantId,
          jobTitleId: validated.jobTitleId,
          departmentId: validated.departmentId,
          description: validated.description,
          requirements: validated.requirements,
          salary_min: validated.salary_min,
          salary_max: validated.salary_max,
          currency: validated.currency,
          status: validated.status ?? 'DRAFT',
          postedAt: validated.status === 'PUBLISHED' ? new Date() : null,
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating job:', error);
      return c.json({ success: false, error: { message: 'Failed to create job' } }, 500);
    }
  });

  app.patch('/jobs/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const existing = await prisma.jobRequisition.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      const body = await c.req.json();
      const updateSchema = JobRequisitionSchema.partial().extend({
        status: z.enum(['DRAFT', 'APPROVED', 'PUBLISHED', 'CLOSED', 'ARCHIVED']).optional(),
      });
      const validated = updateSchema.parse(body);

      const updated = await prisma.jobRequisition.update({
        where: { id },
        data: {
          ...validated,
          postedAt:
            validated.status === 'PUBLISHED' && !existing.postedAt
              ? new Date()
              : existing.postedAt,
          closedAt: validated.status === 'CLOSED' ? new Date() : existing.closedAt,
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating job:', error);
      return c.json({ success: false, error: { message: 'Failed to update job' } }, 500);
    }
  });

  app.get('/applications', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const parsed = ListQuerySchema.parse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status'),
      });
      const jobRequisitionId = c.req.query('jobRequisitionId');

      const where: { tenantId: string; status?: string; jobRequisitionId?: string } = { tenantId };
      if (parsed.status) where.status = parsed.status;
      if (jobRequisitionId) where.jobRequisitionId = jobRequisitionId;

      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { createdAt: 'desc' },
          include: {
            jobRequisition: true,
            interviews: { orderBy: { scheduledAt: 'asc' } },
          },
        }),
        prisma.application.count({ where }),
      ]);

      return c.json({
        success: true,
        data: applications,
        meta: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          hasMore: parsed.page * parsed.limit < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Invalid query', details: error.errors } }, 400);
      }
      console.error('Error fetching applications:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch applications' } }, 500);
    }
  });

  app.get('/applications/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const application = await prisma.application.findFirst({
        where: { id, tenantId },
        include: {
          jobRequisition: true,
          interviews: { orderBy: { scheduledAt: 'asc' } },
        },
      });

      if (!application) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      return c.json({ success: true, data: application });
    } catch (error) {
      console.error('Error fetching application:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch application' } }, 500);
    }
  });

  app.post('/applications', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const body = await c.req.json();
      const validated = ApplicationSchema.parse(body);

      const job = await prisma.jobRequisition.findFirst({
        where: { id: validated.jobRequisitionId, tenantId },
      });
      if (!job) {
        return c.json({ success: false, error: { message: 'Job not found' } }, 404);
      }

      const existing = await prisma.application.findFirst({
        where: {
          tenantId,
          jobRequisitionId: validated.jobRequisitionId,
          email: validated.email,
        },
      });
      if (existing) {
        return c.json(
          { success: false, error: { message: 'Candidate already applied for this job' } },
          400
        );
      }

      const created = await prisma.application.create({
        data: {
          tenantId,
          jobRequisitionId: validated.jobRequisitionId,
          firstName: validated.firstName,
          lastName: validated.lastName,
          email: validated.email,
          phone: validated.phone,
          resumeUrl: validated.resumeUrl,
          coverLetter: validated.coverLetter,
          status: validated.status ?? 'APPLIED',
          currentStage: validated.currentStage ?? 'APPLIED',
        },
        include: { jobRequisition: true, interviews: true },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating application:', error);
      return c.json({ success: false, error: { message: 'Failed to create application' } }, 500);
    }
  });

  app.patch('/applications/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const existing = await prisma.application.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      const body = await c.req.json();
      const updateSchema = z
        .object({
          status: z
            .enum([
              'APPLIED',
              'SCREENING',
              'PHONE_INTERVIEW',
              'TECHNICAL_TEST',
              'PANEL_INTERVIEW',
              'OFFER',
              'HIRED',
              'REJECTED',
            ])
            .optional(),
          currentStage: z.string().optional(),
          currentScore: z.number().min(0).max(100).optional(),
          coverLetter: z.string().optional(),
          phone: z.string().optional(),
        })
        .strict();
      const validated = updateSchema.parse(body);

      const updated = await prisma.application.update({
        where: { id },
        data: validated,
        include: { jobRequisition: true, interviews: { orderBy: { scheduledAt: 'asc' } } },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating application:', error);
      return c.json({ success: false, error: { message: 'Failed to update application' } }, 500);
    }
  });

  app.get('/interviews', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const parsed = ListQuerySchema.parse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });
      const applicationId = c.req.query('applicationId');

      const where: { application?: { tenantId: string; id?: string } } = {
        application: { tenantId },
      };
      if (applicationId) where.application = { tenantId, id: applicationId };

      const [interviews, total] = await Promise.all([
        prisma.interview.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { scheduledAt: 'asc' },
          include: {
            application: {
              include: { jobRequisition: true },
            },
          },
        }),
        prisma.interview.count({ where }),
      ]);

      return c.json({
        success: true,
        data: interviews,
        meta: {
          page: parsed.page,
          limit: parsed.limit,
          total,
          hasMore: parsed.page * parsed.limit < total,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Invalid query', details: error.errors } }, 400);
      }
      console.error('Error fetching interviews:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch interviews' } }, 500);
    }
  });

  app.get('/interviews/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const interview = await prisma.interview.findFirst({
        where: { id, application: { tenantId } },
        include: {
          application: {
            include: { jobRequisition: true },
          },
        },
      });

      if (!interview) {
        return c.json({ success: false, error: { message: 'Interview not found' } }, 404);
      }

      return c.json({ success: true, data: interview });
    } catch (error) {
      console.error('Error fetching interview:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch interview' } }, 500);
    }
  });

  app.post('/interviews', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const body = await c.req.json();
      const validated = InterviewSchema.parse(body);

      const application = await prisma.application.findFirst({
        where: { id: validated.applicationId, tenantId },
      });
      if (!application) {
        return c.json({ success: false, error: { message: 'Application not found' } }, 404);
      }

      const created = await prisma.interview.create({
        data: {
          applicationId: validated.applicationId,
          interviewerId: validated.interviewerId,
          stage: validated.stage,
          scheduledAt: new Date(validated.scheduledAt),
          completedAt: validated.completedAt ? new Date(validated.completedAt) : undefined,
          notes: validated.notes,
          score: validated.score,
        },
        include: {
          application: { include: { jobRequisition: true } },
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating interview:', error);
      return c.json({ success: false, error: { message: 'Failed to create interview' } }, 500);
    }
  });

  app.patch('/interviews/:id', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      const id = c.req.param('id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const existing = await prisma.interview.findFirst({
        where: { id, application: { tenantId } },
      });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Interview not found' } }, 404);
      }

      const body = await c.req.json();
      const updateSchema = z
        .object({
          interviewerId: z.string().min(1).optional(),
          stage: z.enum(['PHONE_INTERVIEW', 'TECHNICAL_TEST', 'PANEL_INTERVIEW']).optional(),
          scheduledAt: z.string().datetime().optional(),
          completedAt: z.string().datetime().optional(),
          notes: z.string().optional(),
          score: z.number().min(0).max(100).optional(),
        })
        .strict();
      const validated = updateSchema.parse(body);

      const updated = await prisma.interview.update({
        where: { id },
        data: {
          ...validated,
          scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : undefined,
          completedAt: validated.completedAt ? new Date(validated.completedAt) : undefined,
        },
        include: {
          application: { include: { jobRequisition: true } },
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating interview:', error);
      return c.json({ success: false, error: { message: 'Failed to update interview' } }, 500);
    }
  });

  app.get('/summary', async (c) => {
    try {
      const tenantId = c.req.header('x-tenant-id');
      if (!tenantId) {
        return c.json({ success: false, error: { message: 'Tenant ID required' } }, 400);
      }

      const [openPositions, totalApplications, shortlisted, rejected, scheduledInterviews] =
        await Promise.all([
          prisma.jobRequisition.count({ where: { tenantId, status: 'PUBLISHED' } }),
          prisma.application.count({ where: { tenantId } }),
          prisma.application.count({ where: { tenantId, status: 'PANEL_INTERVIEW' } }),
          prisma.application.count({ where: { tenantId, status: 'REJECTED' } }),
          prisma.interview.count({
            where: { application: { tenantId }, completedAt: null },
          }),
        ]);

      return c.json({
        success: true,
        data: {
          openPositions,
          totalApplications,
          shortlisted,
          rejected,
          scheduledInterviews,
          conversionRate:
            totalApplications > 0
              ? Number(((shortlisted / totalApplications) * 100).toFixed(1))
              : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching recruitment summary:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch summary' } }, 500);
    }
  });

  return app;
}
