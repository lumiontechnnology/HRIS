import { prisma } from '@lumion/database';

export const dynamic = 'force-dynamic';

function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = utcDateString();

  const exits = await prisma.$queryRawUnsafe<
    Array<{ id: string; employeeId: string; lastWorkingDay: Date }>
  >(
    `SELECT id, "employeeId", "lastWorkingDay"
       FROM "EmployeeExit"
      WHERE "exitStatus" = 'NOTICE_PERIOD'
        AND "lastWorkingDay" = $1::date`,
    today
  );

  for (const exit of exits) {
    await prisma.employee.update({
      where: { id: exit.employeeId },
      data: {
        employmentStatus: 'EXITED',
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "EmployeeExit"
          SET "exitStatus" = 'EXITED', "updatedAt" = now()
        WHERE id = $1`,
      exit.id
    );
  }

  return new Response(JSON.stringify({ success: true, processed: exits.length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
