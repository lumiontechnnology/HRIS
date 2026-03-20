import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';

function isAuthorized(req: NextRequest): boolean {
  const providedSecret = req.headers.get('x-lumion-master-password');
  const expectedSecret = process.env.LUMION_MASTER_PASSWORD;
  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
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

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = (await req.json()) as { tenantId?: string; isActive?: boolean };
  const tenantId = body.tenantId?.trim();

  if (!tenantId || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ success: false, error: { message: 'tenantId and isActive are required' } }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: body.isActive },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ success: true, data: tenant });
}
