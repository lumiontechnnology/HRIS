import { prisma } from '@lumion/database';

export interface AttendanceSummary {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  daysHalfDay: number;
  totalWorkedDays: number;
  totalOvertimeHrs: number;
  attendanceRate: number;
}

type WorkScheduleRow = {
  workDays: string[] | null;
};

type AttendanceRow = {
  status: string;
  overtimeHours: unknown;
};

function toDateOnly(input: string | Date): Date {
  const value = typeof input === 'string' ? new Date(input) : new Date(input);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayCode(input: Date): string {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][input.getUTCDay()] || 'SUN';
}

async function workDaysForTenant(tenantId: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<WorkScheduleRow[]>(
    `SELECT "workDays" FROM "WorkSchedule" WHERE "tenantId" = $1 LIMIT 1`,
    tenantId
  );

  const workDays = rows[0]?.workDays;
  if (!workDays || workDays.length === 0) {
    return ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  }

  return workDays;
}

export async function countWorkingDays(periodStart: string, periodEnd: string, tenantId: string): Promise<number> {
  const start = toDateOnly(periodStart);
  const end = toDateOnly(periodEnd);
  const workDays = await workDaysForTenant(tenantId);

  let count = 0;
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (workDays.includes(dayCode(cursor))) {
      count += 1;
    }
  }

  return count;
}

export async function getAttendanceSummary(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  tenantId: string
): Promise<AttendanceSummary> {
  const records = await prisma.$queryRawUnsafe<AttendanceRow[]>(
    `SELECT "status", COALESCE("overtimeHours", 0) AS "overtimeHours"
       FROM "Attendance"
      WHERE "employeeId" = $1
        AND "date" >= $2::date
        AND "date" <= $3::date`,
    employeeId,
    periodStart,
    periodEnd
  );

  const totalWorkingDays = await countWorkingDays(periodStart, periodEnd, tenantId);

  const daysPresent = records.filter((record) => ['PRESENT', 'LATE'].includes(record.status)).length;
  const daysAbsent = records.filter((record) => record.status === 'ABSENT').length;
  const daysOnLeave = records.filter((record) => record.status === 'ON_LEAVE').length;
  const daysHalfDay = records.filter((record) => record.status === 'HALF_DAY').length;
  const totalWorkedDays = daysPresent + daysHalfDay * 0.5;
  const totalOvertimeHrs = records.reduce((sum, record) => sum + Number(record.overtimeHours || 0), 0);

  return {
    employeeId,
    periodStart,
    periodEnd,
    totalWorkingDays,
    daysPresent,
    daysAbsent,
    daysOnLeave,
    daysHalfDay,
    totalWorkedDays,
    totalOvertimeHrs,
    attendanceRate: totalWorkingDays > 0 ? totalWorkedDays / totalWorkingDays : 0,
  };
}
