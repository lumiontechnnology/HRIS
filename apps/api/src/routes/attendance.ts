import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from '../index.js';
import { getRolesFromContext } from '../lib/auth/rbac.js';

type Env = AppEnv;

const ClockSchema = z.object({
  employeeId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

type WorkScheduleRow = {
  workStart: string;
  workDays: string[];
  graceMinutes: number;
  overtimeAfter: number;
};

const FALLBACK_SCHEDULE: WorkScheduleRow = {
  workStart: '08:00',
  workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  graceMinutes: 15,
  overtimeAfter: 8,
};

function startOfUtcDay(input = new Date()): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0));
}

function addDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function weekdayCode(input: Date): string {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][input.getUTCDay()] || 'SUN';
}

function resolveClientIp(headerValue: string | null): string {
  if (!headerValue) return 'unknown';
  const [first] = headerValue.split(',');
  return first?.trim() || 'unknown';
}

async function getWorkSchedule(tenantId: string): Promise<WorkScheduleRow> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      workStart: string;
      workDays: string[] | null;
      graceMinutes: number;
      overtimeAfter: unknown;
    }>
  >(
    `SELECT "workStart", "workDays", "graceMinutes", "overtimeAfter"
     FROM "WorkSchedule"
     WHERE "tenantId" = $1
     LIMIT 1`,
    tenantId
  );

  const row = rows[0];
  if (!row) return FALLBACK_SCHEDULE;

  return {
    workStart: row.workStart || FALLBACK_SCHEDULE.workStart,
    workDays: row.workDays && row.workDays.length > 0 ? row.workDays : FALLBACK_SCHEDULE.workDays,
    graceMinutes: Number.isFinite(row.graceMinutes) ? row.graceMinutes : FALLBACK_SCHEDULE.graceMinutes,
    overtimeAfter: Number(row.overtimeAfter || FALLBACK_SCHEDULE.overtimeAfter),
  };
}

async function resolveScopedEmployeeId(c: any, providedEmployeeId?: string): Promise<string | null> {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const roles = getRolesFromContext(c);
  const hasElevatedRole = roles.some((role) => ['SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR', 'PAYROLL_AUDITOR'].includes(role));

  if (providedEmployeeId && hasElevatedRole) {
    const employee = await prisma.employee.findFirst({
      where: { id: providedEmployeeId, tenantId },
      select: { id: true },
    });
    return employee?.id || null;
  }

  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });

  return employee?.id || null;
}

export const createAttendanceRoutes = (): Hono<Env> => {
  const app = new Hono<Env>();

  /**
   * POST /api/v1/attendance/clock-in
   * Record clock-in time
   */
  app.post('/clock-in', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validatedData = ClockSchema.parse(body);

      const employeeId = await resolveScopedEmployeeId(c, validatedData.employeeId);
      if (!employeeId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee profile not found for this user' } },
          404
        );
      }

      const employee = await prisma.employee.findFirst({
        where: { tenantId, id: employeeId },
      });

      if (!employee) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
          404
        );
      }

      const isActive = ['ACTIVE', 'NOTICE_PERIOD'].includes(employee.employmentStatus);
      if (!isActive) {
        return c.json(
          { success: false, error: { code: 'INACTIVE_EMPLOYEE', message: 'Only active employees can clock in' } },
          403
        );
      }

      // Check if already clocked in today
      const today = startOfUtcDay();
      const tomorrow = addDays(today, 1);
      const schedule = await getWorkSchedule(tenantId);
      const dayCode = weekdayCode(today);

      if (!schedule.workDays.includes(dayCode)) {
        return c.json(
          {
            success: false,
            error: { code: 'WEEKEND', message: 'No sign-in required for non-working days' },
          },
          409
        );
      }

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          tenantId,
          employeeId,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (existingRecord) {
        return c.json(
          {
            success: false,
            error: { code: 'ALREADY_CLOCKED_IN', message: 'Already clocked in today' },
          },
          400
        );
      }

      // Check if on approved leave
      const leaveRequest = await prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

      if (leaveRequest) {
        return c.json(
          {
            success: false,
            error: { code: 'ON_LEAVE', message: 'Cannot clock in while on approved leave' },
          },
          409
        );
      }

      const clockInTime = new Date();
      const [startHourRaw, startMinuteRaw] = schedule.workStart.split(':').map((item) => Number(item));
      const startHour = Number.isFinite(startHourRaw) ? startHourRaw : 8;
      const startMinute = Number.isFinite(startMinuteRaw) ? startMinuteRaw : 0;
      const expectedStart = new Date(today);
      expectedStart.setUTCHours(startHour, startMinute + schedule.graceMinutes, 0, 0);
      const isLate = clockInTime.getTime() > expectedStart.getTime();

      const record = await prisma.attendance.create({
        data: {
          tenantId,
          employeeId,
          date: today,
          clockIn: clockInTime,
          status: isLate ? 'LATE' : 'PRESENT',
          notes: validatedData.notes,
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      await prisma.$executeRawUnsafe(
        `UPDATE "Attendance"
            SET "clockInIp" = $1
          WHERE id = $2`,
        resolveClientIp(c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null),
        record.id
      );

      return c.json(
        {
          success: true,
          data: record,
          message: `Clock-in recorded at ${clockInTime.toLocaleTimeString()}`,
        },
        201
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
          },
          400
        );
      }
      console.error('Error recording clock-in:', error);
      return c.json(
        { success: false, error: { code: 'CREATE_ERROR', message: 'Failed to record clock-in' } },
        500
      );
    }
  });

  /**
   * POST /api/v1/attendance/clock-out
   * Record clock-out time
   */
  app.post('/clock-out', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();
      const validatedData = ClockSchema.parse(body);

      const employeeId = await resolveScopedEmployeeId(c, validatedData.employeeId);
      if (!employeeId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee profile not found for this user' } },
          404
        );
      }

      const today = startOfUtcDay();
      const tomorrow = addDays(today, 1);

      const record = await prisma.attendance.findFirst({
        where: {
          employeeId,
          tenantId,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!record) {
        return c.json(
          { success: false, error: { code: 'NOT_CLOCKED_IN', message: 'Not clocked in today' } },
          400
        );
      }

      if (record.clockOut) {
        return c.json(
          { success: false, error: { code: 'ALREADY_CLOCKED_OUT', message: 'Already clocked out' } },
          400
        );
      }

      const clockOutTime = new Date();

      if (!record.clockIn) {
        return c.json(
          { success: false, error: { code: 'INVALID_STATE', message: 'Clock-in time missing' } },
          400
        );
      }

      // Calculate duration in minutes
      const duration = Math.max(
        0,
        Math.round((clockOutTime.getTime() - record.clockIn.getTime()) / (1000 * 60))
      );
      const workedHoursRaw = duration / 60;
      const workedHours = Math.round(workedHoursRaw * 100) / 100;
      const schedule = await getWorkSchedule(tenantId);
      const overtimeHours = Math.max(0, workedHoursRaw - schedule.overtimeAfter);

      let status = record.status;
      if (workedHoursRaw < 4) {
        status = 'HALF_DAY';
      }
      if (record.status === 'LATE') {
        status = 'LATE';
      }

      const updated = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          clockOut: clockOutTime,
          duration,
          status,
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      await prisma.$executeRawUnsafe(
        `UPDATE "Attendance"
            SET "clockOutIp" = $1,
                "workedHours" = $2,
                "overtimeHours" = $3
          WHERE id = $4`,
        resolveClientIp(c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null),
        workedHours,
        Math.round(overtimeHours * 100) / 100,
        record.id
      );

      return c.json({
        success: true,
        data: updated,
        message: `Clock-out recorded. Duration: ${(duration / 60).toFixed(2)} hours`,
      });
    } catch (error) {
      console.error('Error recording clock-out:', error);
      return c.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to record clock-out' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/attendance/today
   * Get current user's attendance status for today
   */
  app.get('/today', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const employeeId = await resolveScopedEmployeeId(c);

      if (!employeeId) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee profile not found for this user' } },
          404
        );
      }

      const today = startOfUtcDay();
      const todayIso = toIsoDate(today);
      const tomorrow = addDays(today, 1);
      const schedule = await getWorkSchedule(tenantId);

      const leaveRequest = await prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

      const record = await prisma.attendance.findFirst({
        where: {
          tenantId,
          employeeId,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        select: {
          status: true,
          clockIn: true,
          clockOut: true,
          duration: true,
        },
      });

      const [hoursRow] = record
        ? await prisma.$queryRawUnsafe<Array<{ workedHours: unknown }>>(
            `SELECT "workedHours" FROM "Attendance" WHERE "employeeId" = $1 AND "date" = $2::date LIMIT 1`,
            employeeId,
            todayIso
          )
        : [];

      const dayCode = weekdayCode(today);
      const isWeekend = !schedule.workDays.includes(dayCode);
      const status = leaveRequest
        ? 'ON_LEAVE'
        : isWeekend
          ? 'WEEKEND'
          : record?.status || null;

      const canClockIn = !record?.clockIn && !leaveRequest && !isWeekend;
      const canClockOut = !!record?.clockIn && !record?.clockOut;

      return c.json({
        success: true,
        data: {
          date: todayIso,
          status,
          clockIn: record?.clockIn || null,
          clockOut: record?.clockOut || null,
          workedHours:
            typeof hoursRow?.workedHours === 'number'
              ? hoursRow.workedHours
              : record?.duration
                ? Math.round((record.duration / 60) * 100) / 100
                : null,
          canClockIn,
          canClockOut,
        },
      });
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch today attendance' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/attendance
   * List attendance records with filters
   */
  app.get('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');
      const employeeId = c.req.query('employeeId');
      const status = c.req.query('status');

      const skip = (page - 1) * limit;

      const where: any = { tenantId };

      if (startDate) {
        where.date = { ...where.date, gte: new Date(startDate) };
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date = { ...where.date, lte: end };
      }
      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;

      const [records, total] = await Promise.all([
        prisma.attendance.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.attendance.count({ where }),
      ]);

      return c.json({
        success: true,
        data: records,
        meta: {
          page,
          limit,
          total,
          hasMore: skip + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch attendance' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/attendance/employee/:employeeId
   * Get attendance history for specific employee
   */
  app.get('/employee/:employeeId', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const employeeId = c.req.param('employeeId');
      const page = parseInt(c.req.query('page') || '1');
      const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
      const month = c.req.query('month');

      const skip = (page - 1) * limit;

      const where: any = { tenantId, employeeId };

      if (month) {
        // Parse month as YYYY-MM
        const [year, monthNum] = month.split('-');
        const startDate = new Date(`${year}-${monthNum}-01`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        where.date = {
          gte: startDate,
          lt: endDate,
        };
      }

      const [records, total] = await Promise.all([
        prisma.attendance.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.attendance.count({ where }),
      ]);

      // Calculate summary
      const presentCount = records.filter((r) => r.status === 'PRESENT').length;
      const lateCount = records.filter((r) => r.status === 'LATE').length;
      const absentCount = records.filter((r) => r.status === 'ABSENT').length;
      const leaveCount = records.filter((r) => r.status === 'ON_LEAVE').length;

      return c.json({
        success: true,
        data: records,
        summary: {
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          onLeave: leaveCount,
        },
        meta: {
          page,
          limit,
          total,
          hasMore: skip + limit < total,
        },
      });
    } catch (error) {
      console.error('Error fetching employee attendance:', error);
      return c.json(
        { success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch attendance' } },
        500
      );
    }
  });

  /**
   * GET /api/v1/attendance/report/:month
   * Get monthly attendance report
   */
  app.get('/report/:month', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const month = c.req.param('month'); // YYYY-MM

      const [year, monthNum] = month.split('-');
      const startDate = new Date(`${year}-${monthNum}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      const records = await prisma.attendance.findMany({
        where: {
          tenantId,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
      });

      // Group by employee
      const reportByEmployee: Record<
        string,
        {
          employee: (typeof records)[0]['employee'];
          present: number;
          late: number;
          absent: number;
          onLeave: number;
          totalHours: number;
          avgHours: number;
        }
      > = {};

      records.forEach((record) => {
        if (!reportByEmployee[record.employeeId]) {
          reportByEmployee[record.employeeId] = {
            employee: record.employee,
            present: 0,
            late: 0,
            absent: 0,
            onLeave: 0,
            totalHours: 0,
            avgHours: 0,
          };
        }

        const emp = reportByEmployee[record.employeeId];
        if (record.status === 'PRESENT') emp.present++;
        else if (record.status === 'LATE') emp.late++;
        else if (record.status === 'ABSENT') emp.absent++;
        else if (record.status === 'ON_LEAVE') emp.onLeave++;

        if (record.duration) {
          emp.totalHours += record.duration / 60;
        }
      });

      // Calculate averages
      Object.values(reportByEmployee).forEach((emp) => {
        const workDays = emp.present + emp.late;
        emp.avgHours = workDays > 0 ? emp.totalHours / workDays : 0;
      });

      const summary = {
        month,
        totalEmployees: Object.keys(reportByEmployee).length,
        totalRecords: records.length,
        averageAttendance: (
          (records.filter((r) => r.status !== 'ABSENT').length / records.length) *
          100
        ).toFixed(2),
      };

      return c.json({
        success: true,
        data: Object.values(reportByEmployee),
        summary,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      return c.json(
        { success: false, error: { code: 'REPORT_ERROR', message: 'Failed to generate report' } },
        500
      );
    }
  });

  return app;
};
