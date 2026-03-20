import { PrismaClient } from '@lumion/database';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const actor = await getAuthedUserWithTenant(request);
    if (!actor) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { avatar?: string | null };
    const avatar = (body.avatar || '').trim();

    if (!avatar || !isValidImageUrl(avatar)) {
      return NextResponse.json({ success: false, error: 'Please provide a valid image URL' }, { status: 400 });
    }

    const employee = await prisma.employee.updateMany({
      where: {
        id: context.params.id,
        tenantId: actor.tenantId,
      },
      data: {
        avatar,
      },
    });

    if (employee.count === 0) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { avatar } });
  } catch (error) {
    console.error('avatar update error', error);
    return NextResponse.json({ success: false, error: 'Failed to update avatar' }, { status: 500 });
  }
}
