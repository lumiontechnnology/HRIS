import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';
import { createAdminClient } from '@/lib/supabase/admin';

function isAuthorized(req: NextRequest): boolean {
  const providedSecret = req.headers.get('x-lumion-master-password');
  const expectedSecret = process.env.LUMION_MASTER_PASSWORD;
  return Boolean(expectedSecret && providedSecret === expectedSecret);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = (await req.json()) as { tenantId?: string };
  const tenantId = body.tenantId?.trim();

  if (!tenantId) {
    return NextResponse.json({ success: false, error: { message: 'tenantId is required' } }, { status: 400 });
  }

  const superAdmin = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      roles: {
        some: {
          name: 'SUPER_ADMIN',
        },
      },
    },
    select: {
      email: true,
    },
  });

  if (!superAdmin?.email) {
    return NextResponse.json(
      { success: false, error: { message: 'No active SUPER_ADMIN found for this tenant' } },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: superAdmin.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/`,
    },
  });

  if (error) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }

  const actionLink = data?.properties?.action_link;
  if (!actionLink) {
    return NextResponse.json(
      { success: false, error: { message: 'Unable to generate impersonation link' } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      email: superAdmin.email,
      actionLink,
    },
  });
}
