import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

const seed = [
  { day: 'Mon', value: 94 },
  { day: 'Tue', value: 91 },
  { day: 'Wed', value: 95 },
  { day: 'Thu', value: 92 },
  { day: 'Fri', value: 96 },
];

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ data: seed, trend: 2, period: 'Week' });
    }

    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findMany({
      where: {
        tenantId: user.tenantId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: {
        date: true,
        status: true,
      },
      orderBy: { date: 'asc' },
    });

    if (!attendance.length) {
      return NextResponse.json({ data: seed, trend: 2, period: 'Week' });
    }

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const bucket = labels.map((label) => ({ day: label, present: 0, total: 0 }));

    for (const item of attendance) {
      const day = new Date(item.date).getDay();
      const index = (day + 6) % 7;
      bucket[index].total += 1;
      if (item.status === 'PRESENT' || item.status === 'LATE' || item.status === 'EARLY_DEPARTURE') {
        bucket[index].present += 1;
      }
    }

    const data = bucket
      .slice(0, 5)
      .map((item) => ({ day: item.day, value: item.total ? Math.round((item.present / item.total) * 100) : 0 }));

    const firstHalf = data.slice(0, 2).reduce((sum, item) => sum + item.value, 0) / 2;
    const secondHalf = data.slice(2).reduce((sum, item) => sum + item.value, 0) / 3;
    const trend = Math.round(secondHalf - firstHalf);

    return NextResponse.json({ data, trend, period: 'Week' });
  } catch (error) {
    console.error('weekly-summary error', error);
    return NextResponse.json({ data: seed, trend: 2, period: 'Week' });
  }
}
