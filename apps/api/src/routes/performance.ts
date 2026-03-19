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

const GoalSchema = z.object({
  employeeId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  weight: z.number().int().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'MISSED', 'ON_TRACK']).optional(),
});

const CycleSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'PROBATION']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const ReviewSchema = z.object({
  employeeId: z.string().min(1),
  cycleId: z.string().min(1),
  reviewerId: z.string().optional(),
  status: z
    .enum(['DRAFT', 'SELF_APPRAISAL', 'MANAGER_REVIEW', 'CALIBRATION', 'FINALIZED', 'SHARED_WITH_EMPLOYEE'])
    .optional(),
  selfRating: z.number().int().min(1).max(5).optional(),
  managerRating: z.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
});

const ReviewUpdateSchema = z
  .object({
    reviewerId: z.string().optional(),
    status: z
      .enum(['DRAFT', 'SELF_APPRAISAL', 'MANAGER_REVIEW', 'CALIBRATION', 'FINALIZED', 'SHARED_WITH_EMPLOYEE'])
      .optional(),
    selfRating: z.number().int().min(1).max(5).optional(),
    managerRating: z.number().int().min(1).max(5).optional(),
    comments: z.string().optional(),
  })
  .strict();

export function createPerformanceRoutes(): Hono<Env> {
  const app = new Hono<Env>();

  app.get('/summary', async (c) => {
    try {
      const tenantId = c.get('tenantId');

      const [goalsTotal, activeGoals, completedGoals, missedGoals, reviewsTotal, finalizedReviews] =
        await Promise.all([
          prisma.goal.count({ where: { tenantId } }),
          prisma.goal.count({ where: { tenantId, status: { in: ['ACTIVE', 'ON_TRACK'] } } }),
          prisma.goal.count({ where: { tenantId, status: 'COMPLETED' } }),
          prisma.goal.count({ where: { tenantId, status: 'MISSED' } }),
          prisma.performanceReview.count({ where: { tenantId } }),
          prisma.performanceReview.count({ where: { tenantId, status: 'FINALIZED' } }),
        ]);

      const ratingGroups = await prisma.performanceReview.groupBy({
        by: ['managerRating'],
        where: {
          tenantId,
          managerRating: { not: null },
        },
        _count: { id: true },
      });

      const totalRated = ratingGroups.reduce((sum, group) => sum + group._count.id, 0);
      const high = ratingGroups
        .filter((group) => Number(group.managerRating) >= 4)
        .reduce((sum, group) => sum + group._count.id, 0);
      const solid = ratingGroups
        .filter((group) => Number(group.managerRating) >= 3 && Number(group.managerRating) < 4)
        .reduce((sum, group) => sum + group._count.id, 0);
      const needsSupport = Math.max(0, totalRated - high - solid);

      return c.json({
        success: true,
        data: {
          goalsTotal,
          activeGoals,
          completedGoals,
          missedGoals,
          reviewsTotal,
          finalizedReviews,
          distribution: [
            {
              label: 'High',
              value: totalRated > 0 ? Number(((high / totalRated) * 100).toFixed(1)) : 0,
            },
            {
              label: 'Solid',
              value: totalRated > 0 ? Number(((solid / totalRated) * 100).toFixed(1)) : 0,
            },
            {
              label: 'Needs Support',
              value: totalRated > 0 ? Number(((needsSupport / totalRated) * 100).toFixed(1)) : 0,
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error fetching performance summary:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch summary' } }, 500);
    }
  });

  app.get('/goals', async (c) => {
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

      const [goals, total] = await Promise.all([
        prisma.goal.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true },
            },
          },
        }),
        prisma.goal.count({ where }),
      ]);

      return c.json({
        success: true,
        data: goals,
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
      console.error('Error fetching goals:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch goals' } }, 500);
    }
  });

  app.post('/goals', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = GoalSchema.parse(body);

      const employee = await prisma.employee.findFirst({
        where: { id: validated.employeeId, tenantId },
        select: { id: true },
      });

      if (!employee) {
        return c.json({ success: false, error: { message: 'Employee not found' } }, 404);
      }

      const created = await prisma.goal.create({
        data: {
          tenantId,
          employeeId: validated.employeeId,
          title: validated.title,
          description: validated.description,
          targetValue: validated.targetValue,
          currentValue: validated.currentValue,
          weight: validated.weight,
          status: validated.status ?? 'ACTIVE',
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating goal:', error);
      return c.json({ success: false, error: { message: 'Failed to create goal' } }, 500);
    }
  });

  app.patch('/goals/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');
      const body = await c.req.json();
      const validated = GoalSchema.partial().parse(body);

      const existing = await prisma.goal.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Goal not found' } }, 404);
      }

      const updated = await prisma.goal.update({
        where: { id },
        data: validated,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating goal:', error);
      return c.json({ success: false, error: { message: 'Failed to update goal' } }, 500);
    }
  });

  app.get('/cycles', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const cycles = await prisma.performanceCycle.findMany({
        where: { tenantId },
        orderBy: { startDate: 'desc' },
      });

      return c.json({ success: true, data: cycles });
    } catch (error) {
      console.error('Error fetching cycles:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch cycles' } }, 500);
    }
  });

  app.post('/cycles', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = CycleSchema.parse(body);

      const created = await prisma.performanceCycle.create({
        data: {
          tenantId,
          name: validated.name,
          type: validated.type,
          startDate: new Date(validated.startDate),
          endDate: new Date(validated.endDate),
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating cycle:', error);
      return c.json({ success: false, error: { message: 'Failed to create cycle' } }, 500);
    }
  });

  app.get('/reviews', async (c) => {
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

      const [reviews, total] = await Promise.all([
        prisma.performanceReview.findMany({
          where,
          skip: (parsed.page - 1) * parsed.limit,
          take: parsed.limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            cycle: true,
            employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
            reviewer: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          },
        }),
        prisma.performanceReview.count({ where }),
      ]);

      return c.json({
        success: true,
        data: reviews,
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
      console.error('Error fetching reviews:', error);
      return c.json({ success: false, error: { message: 'Failed to fetch reviews' } }, 500);
    }
  });

  app.post('/reviews', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validated = ReviewSchema.parse(body);

      const [employee, cycle] = await Promise.all([
        prisma.employee.findFirst({ where: { id: validated.employeeId, tenantId }, select: { id: true } }),
        prisma.performanceCycle.findFirst({ where: { id: validated.cycleId, tenantId }, select: { id: true } }),
      ]);

      if (!employee || !cycle) {
        return c.json({ success: false, error: { message: 'Employee or cycle not found' } }, 404);
      }

      const created = await prisma.performanceReview.create({
        data: {
          tenantId,
          employeeId: validated.employeeId,
          cycleId: validated.cycleId,
          reviewerId: validated.reviewerId,
          status: validated.status ?? 'DRAFT',
          selfRating: validated.selfRating,
          managerRating: validated.managerRating,
          comments: validated.comments,
        },
        include: {
          cycle: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          reviewer: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        },
      });

      return c.json({ success: true, data: created }, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error creating review:', error);
      return c.json({ success: false, error: { message: 'Failed to create review' } }, 500);
    }
  });

  app.patch('/reviews/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');
      const body = await c.req.json();
      const validated = ReviewUpdateSchema.parse(body);

      const existing = await prisma.performanceReview.findFirst({ where: { id, tenantId } });
      if (!existing) {
        return c.json({ success: false, error: { message: 'Review not found' } }, 404);
      }

      const updated = await prisma.performanceReview.update({
        where: { id },
        data: validated,
        include: {
          cycle: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          reviewer: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        },
      });

      return c.json({ success: true, data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: { message: 'Validation failed', details: error.errors } }, 400);
      }
      console.error('Error updating review:', error);
      return c.json({ success: false, error: { message: 'Failed to update review' } }, 500);
    }
  });

  return app;
}
