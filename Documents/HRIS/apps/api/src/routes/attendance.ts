import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import type { AppEnv } from './index';

type Env = AppEnv;

const ClockSchema = z.object({
  employeeId: z.string().uuid(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
});

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

      const employee = await prisma.employee.findFirst({
        where: { tenantId, id: validatedData.employeeId },
      });

      if (!employee) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Employee not found' } },
          404
        );
      }

      // Check if already clocked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          employeeId: validatedData.employeeId,
          clockInTime: {
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
          employeeId: validatedData.employeeId,
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

      const clockInTime = new Date();
      const status = leaveRequest ? 'ON_LEAVE' : 'PRESENT';

      // Check if late (assume 9 AM start time)
      const nineAM = new Date();
      nineAM.setHours(9, 0, 0, 0);
      const isLate = clockInTime > nineAM;

      const record = await prisma.attendance.create({
        data: {
          tenantId,
          employeeId: validatedData.employeeId,
          date: today,
          clockInTime,
          status: isLate && !leaveRequest ? 'LATE' : status,
          latitude: validatedData.latitude,
          longitude: validatedData.longitude,
          notes: validatedData.notes,
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });

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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const record = await prisma.attendance.findFirst({
        where: {
          employeeId: validatedData.employeeId,
          tenantId,
          clockInTime: {
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

      if (record.clockOutTime) {
        return c.json(
          { success: false, error: { code: 'ALREADY_CLOCKED_OUT', message: 'Already clocked out' } },
          400
        );
      }

      const clockOutTime = new Date();

      // Calculate hours worked
      const hoursWorked =
        (clockOutTime.getTime() - record.clockInTime.getTime()) / (1000 * 60 * 60);

      // Check for early departure (before 5 PM)
      const fivePM = new Date();
      fivePM.setHours(17, 0, 0, 0);
      const isEarlyDeparture = clockOutTime < fivePM && record.status !== 'ON_LEAVE';

      const updated = await prisma.attendance.update({
        where: { id: record.id },
        data: {
          clockOutTime,
          hoursWorked,
          status: isEarlyDeparture && record.status === 'PRESENT' ? 'EARLY_DEPARTURE' : record.status,
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      return c.json({
        success: true,
        data: updated,
        message: `Clock-out recorded. Hours worked: ${hoursWorked.toFixed(2)}`,
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

        if (record.hoursWorked) {
          emp.totalHours += record.hoursWorked;
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
