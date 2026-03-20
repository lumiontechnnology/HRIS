import { PrismaClient } from '@lumion/database';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const actor = await getAuthedUserWithTenant(request);
    if (!actor) {
      return NextResponse.json({ data: [] });
    }

    const hires = await prisma.employee.findMany({
      where: {
        tenantId: actor.tenantId,
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
    return NextResponse.json({ data: [] });
  }
}
