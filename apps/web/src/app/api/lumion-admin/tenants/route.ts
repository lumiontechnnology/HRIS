import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';

export async function GET(req: NextRequest) {
  const providedSecret = req.headers.get('x-lumion-master-password');
  const expectedSecret = process.env.LUMION_MASTER_PASSWORD;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          employees: true,
          users: true,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      size: tenant.size,
      country: tenant.country,
      plan: tenant.plan,
      isActive: tenant.isActive,
      trialEndsAt: tenant.trialEndsAt,
      onboardingComplete: tenant.onboardingComplete,
      createdAt: tenant.createdAt,
      employeesCount: tenant._count.employees,
      usersCount: tenant._count.users,
    })),
  });
}
