import { prisma } from '@lumion/database';

export const dynamic = 'force-dynamic';

function monthlyAccrualByLeaveType(code: string): number {
  const normalized = code.toUpperCase();
  if (normalized.includes('ANNUAL')) return 2;
  if (normalized.includes('SICK')) return 1;
  return 1;
}

function yearStart(year: number): Date {
  return new Date(Date.UTC(year, 0, 1, 0, 0, 0));
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const isJanuary = now.getUTCMonth() === 0;
  const monthKey = `${currentYear}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const employees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE' },
    select: { id: true, tenantId: true },
  });

  const tenantIds = Array.from(new Set(employees.map((employee) => employee.tenantId)));

  let processedTenants = 0;
  let skippedTenants = 0;

  for (const tenantId of tenantIds) {
    const existingJobLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        resource: 'LeaveAccrualJob',
        action: 'CREATE',
        resourceId: monthKey,
      },
    });

    if (existingJobLog) {
      skippedTenants += 1;
      continue;
    }

    const tenantEmployees = employees.filter((employee) => employee.tenantId === tenantId);

    for (const employee of tenantEmployees) {
      const leaveTypes = await prisma.leaveType.findMany({
        where: { tenantId: employee.tenantId },
        select: { id: true, code: true, carryoverLimit: true, carryoverExpiry: true },
      });

      for (const leaveType of leaveTypes) {
        const accrual = monthlyAccrualByLeaveType(leaveType.code);

        const balance = await prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year: currentYear,
            },
          },
          update: {
            available: { increment: accrual },
          },
          create: {
            tenantId: employee.tenantId,
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
            available: accrual,
            taken: 0,
            carried: 0,
          },
        });

        if (isJanuary) {
          const previousYear = currentYear - 1;
          const previousBalance = await prisma.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                year: previousYear,
              },
            },
          });

          if (previousBalance && leaveType.carryoverLimit && leaveType.carryoverLimit > 0) {
            const carry = Math.min(previousBalance.available, leaveType.carryoverLimit);
            const carryExpiry = leaveType.carryoverExpiry
              ? new Date(Date.UTC(currentYear, 0, leaveType.carryoverExpiry, 23, 59, 59))
              : null;

            await prisma.leaveBalance.update({
              where: { id: balance.id },
              data: {
                available: { increment: carry },
                carried: carry,
                carryoverExpiry: carryExpiry,
              },
            });
          }
        }

        await prisma.auditLog.create({
          data: {
            tenantId: employee.tenantId,
            action: 'UPDATE',
            resource: 'LeaveBalance',
            resourceId: `${employee.id}:${leaveType.id}:${currentYear}`,
            changes: {
              accrualAdded: accrual,
              processedAt: now.toISOString(),
              yearStart: yearStart(currentYear).toISOString(),
            },
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        action: 'CREATE',
        resource: 'LeaveAccrualJob',
        resourceId: monthKey,
        changes: {
          status: 'COMPLETED',
          processedAt: now.toISOString(),
          employees: tenantEmployees.length,
        },
      },
    });

    processedTenants += 1;
  }

  return new Response(
    JSON.stringify({
      success: true,
      processedTenants,
      skippedTenants,
      activeEmployees: employees.length,
    }),
    {
    status: 200,
    headers: { 'content-type': 'application/json' },
    }
  );
}
