import { prisma } from '@lumion/database';

export const dynamic = 'force-dynamic';

function utcDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayCode(input: Date): string {
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][input.getUTCDay()] || 'SUN';
}

async function tenantWorkDays(tenantId: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ workDays: string[] | null }>>(
    `SELECT "workDays" FROM "WorkSchedule" WHERE "tenantId" = $1 LIMIT 1`,
    tenantId
  );

  return rows[0]?.workDays && rows[0].workDays.length > 0
    ? rows[0].workDays
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = utcDateOnly();
  const tomorrow = addDays(today, 1);

  const activeEmployees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  const onLeave = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: { employeeId: true },
  });

  const attendanceToday = await prisma.attendance.findMany({
    where: {
      date: { gte: today, lt: tomorrow },
    },
    select: { employeeId: true },
  });

  const onLeaveIds = new Set(onLeave.map((row) => row.employeeId));
  const attendanceIds = new Set(attendanceToday.map((row) => row.employeeId));

  const workDaysByTenant = new Map<string, string[]>();
  const absences = [] as Array<{ tenantId: string; employeeId: string; date: Date; status: string }>;

  for (const employee of activeEmployees) {
    const existingWorkDays = workDaysByTenant.get(employee.tenantId);
    const workDays = existingWorkDays || (await tenantWorkDays(employee.tenantId));

    if (!existingWorkDays) {
      workDaysByTenant.set(employee.tenantId, workDays);
    }

    const isWorkingDay = workDays.includes(dayCode(today));
    if (!isWorkingDay) continue;
    if (attendanceIds.has(employee.id)) continue;
    if (onLeaveIds.has(employee.id)) continue;

    absences.push({
      tenantId: employee.tenantId,
      employeeId: employee.id,
      date: today,
      status: 'ABSENT',
    });
  }

  if (absences.length > 0) {
    await prisma.attendance.createMany({ data: absences, skipDuplicates: true });
  }

  return new Response(JSON.stringify({ success: true, markedAbsent: absences.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
