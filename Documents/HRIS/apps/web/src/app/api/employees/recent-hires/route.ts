import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

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
      return NextResponse.json({ data: [] });
    }

    const hires = await prisma.employee.findMany({
      where: {
        tenantId: user.tenantId,
        employmentStatus: 'ACTIVE',
      },
      orderBy: [{ hireDate: 'desc' }, { createdAt: 'desc' }],
      take: 24,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        hireDate: true,
      },
    });

    return NextResponse.json({ data: hires });
  } catch (error) {
    console.error('recent-hires error', error);
    return NextResponse.json({ success: false, error: 'Failed to load recent hires' }, { status: 500 });
  }
}
