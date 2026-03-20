import { PrismaClient } from '@lumion/database';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthedUserWithTenant(request);
    if (!actor) {
      return NextResponse.json({ data: [], trend: 0, period: 'Month' });
    }

    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const payrollRuns = await prisma.payrollRun.findMany({
      where: {
        tenantId: actor.tenantId,
        period,
      },
      include: {
        payslips: {
          select: {
            netPay: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    if (!payrollRuns.length) {
      return NextResponse.json({ data: [], trend: 0, period: 'Month' });
    }

    const weekBuckets = [0, 0, 0, 0];

    for (const run of payrollRuns) {
      const day = new Date(run.endDate).getUTCDate();
      const weekIndex = Math.min(3, Math.max(0, Math.floor((day - 1) / 7)));
      const total = run.payslips.reduce((sum, slip) => sum + toNumber(slip.netPay), 0);
      weekBuckets[weekIndex] += Math.round(total);
    }

    const data = weekBuckets.map((value, index) => ({ day: `W${index + 1}`, value }));
    const firstHalf = data[0].value + data[1].value;
    const secondHalf = data[2].value + data[3].value;
    const trend = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

    return NextResponse.json({ data, trend, period: 'Month' });
  } catch (error) {
    console.error('monthly-trend error', error);
    return NextResponse.json({ data: [], trend: 0, period: 'Month' });
  }
}
