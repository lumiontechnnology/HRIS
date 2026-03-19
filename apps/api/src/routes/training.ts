import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';

type Env = AppEnv;

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  employeeId: z.string().optional(),
});

const TrainingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  provider: z.string().optional(),
  type: z.enum(['INTERNAL', 'EXTERNAL', 'ONLINE']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  cost: z.number().nonnegative().optional(),
  currency: z.string().min(3).default('NGN'),
});

const EnrollmentSchema = z.object({
  employeeId: z.string().min(1),
  trainingId: z.string().min(1),
  status: z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']).optional(),
  completedAt: z.string().datetime().optional(),
  certificate: z.string().optional(),
  assessmentScore: z.number().min(0).max(100).optional(),
});

const EnrollmentUpdateSchema = z
  .object({
    status: z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']).optional(),
    completedAt: z.string().datetime().optional(),
    certificate: z.string().optional(),
    assessmentScore: z.number().min(0).max(100).optional(),
  })
  .strict();

export function createTrainingRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.get('/summary', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      const [totalTrainings, totalEnrollments, completedEnrollments, inProgressEnrollments] =
        await Promise.all([
          prisma.training.count({ where: { tenantId } }),
          prisma.trainingEnrollment.count({ where: { tenantId } }),
          prisma.trainingEnrollment.count({ where: { tenantId, status: 'COMPLETED' } }),
          prisma.trainingEnrollment.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
        ]);

      return c.json({
        success: true,
        data: {
          totalTrainings,
          totalEnrollments,
          completedEnrollments,
          inProgressEnrollments,
          completionRate:
            totalEnrollments > 0
              ? Number(((completedEnrollments / totalEnrollments) * 100).toFixed(1))
              : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching training summary:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch summary' } }, 500);
    }
  });

  app.get('/catalog', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const parsed = ListQuerySchema.parse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
      });

      const [trainings, total] = await Promise.all([
        prisma.training.findMany({
          where: { tenantId },
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { startDate: 'desc' },
          include: {
            enrollments: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        }),
        prisma.training.count({ where: { tenantId } }),
      ]);

      return c.json({
        success: true,
        data: trainings,
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
      console.error('Error fetching trainings:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch trainings' } }, 500);
    }
  });

  app.post('/catalog', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = TrainingSchema.parse(body);

      const created = await prisma.training.create({
        data: {
          tenantId,
          title: validated.title,
          description: validated.description,
          provider: validated.provider,
          type: validated.type,
          startDate: new Date(validated.startDate),
          endDate: validated.endDate ? new Date(validated.endDate) : null,
          duration: validated.duration,
          cost: validated.cost,
          currency: validated.currency,
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating training:', error);
      return c.json({ success: false, error: { message: 'Failed to create training' } }, 500);
    }
  });

  app.get('/enrollments', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const parsed = ListQuerySchema.parse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status'),
        employeeId: c.req.query('employeeId'),
      });

      const where: { tenantId: string; status?: string; employeeId?: string } = { tenantId };
      if (parsed.status) where.status = parsed.status;
      if (parsed.employeeId) where.employeeId = parsed.employeeId;

      const [enrollments, total] = await Promise.all([
        prisma.trainingEnrollment.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true },
            },
            training: {
              select: { id: true, title: true, provider: true, type: true, startDate: true, endDate: true },
            },
          },
        }),
        prisma.trainingEnrollment.count({ where }),
      ]);

      return c.json({
        success: true,
        data: enrollments,
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
      console.error('Error fetching enrollments:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch enrollments' } }, 500);
    }
  });

  app.post('/enrollments', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = EnrollmentSchema.parse(body);

      const [employee, training] = await Promise.all([
        prisma.employee.findFirst({ where: { id: validated.employeeId, tenantId }, select: { id: true } }),
        prisma.training.findFirst({ where: { id: validated.trainingId, tenantId }, select: { id: true, title: true } }),
      ]);

      if (!employee || !training) {
        return c.json({ success: false, error: { message: 'Employee or training not found' } }, 404);
      }

      const enrollment = await prisma.trainingEnrollment.upsert({
        where: {
          employeeId_trainingId: {
            employeeId: validated.employeeId,
            trainingId: validated.trainingId,
          },
        },
        update: {
          status: validated.status ?? 'ENROLLED',
          completedAt: validated.completedAt ? new Date(validated.completedAt) : null,
          certificate: validated.certificate,
          assessmentScore: validated.assessmentScore,
        },
        create: {
          tenantId,
          employeeId: validated.employeeId,
          trainingId: validated.trainingId,
          status: validated.status ?? 'ENROLLED',
          completedAt: validated.completedAt ? new Date(validated.completedAt) : null,
          certificate: validated.certificate,
          assessmentScore: validated.assessmentScore,
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
          training: {
            select: { id: true, title: true, provider: true, type: true, startDate: true, endDate: true },
          },
        },
      });

      return c.json({ success: true, data: enrollment }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating enrollment:', error);
      return c.json({ success: false, error: { message: 'Failed to create enrollment' } }, 500);
    }
  });

  app.patch('/enrollments/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');
      const body = await c.req.json();
      const validated = EnrollmentUpdateSchema.parse(body);

      const existing = await prisma.trainingEnrollment.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Enrollment not found' } }, 404);
      }

      const updated = await prisma.trainingEnrollment.update({
        where: { id },
        data: {
          ...validated,
          completedAt: validated.completedAt ? new Date(validated.completedAt) : undefined,
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
          training: {
            select: { id: true, title: true, provider: true, type: true, startDate: true, endDate: true },
          },
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating enrollment:', error);
      return c.json({ success: false, error: { message: 'Failed to update enrollment' } }, 500);
    }
  });

  return app;
}
