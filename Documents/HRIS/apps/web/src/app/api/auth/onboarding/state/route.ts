import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export async function GET(req: NextRequest) {
  const actor = await getAuthedUserWithTenant(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const [tenant, schedule] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: actor.tenantId } }),
    prisma.workSchedule.findUnique({ where: { tenantId: actor.tenantId } }),
  ]);

  if (!tenant) {
    return NextResponse.json({ success: false, error: { message: 'Tenant not found' } }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      actor,
      tenant,
      schedule,
    },
  });
}
