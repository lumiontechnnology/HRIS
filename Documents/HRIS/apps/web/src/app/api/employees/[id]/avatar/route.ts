import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

export async function PATCH(request: Request, context: { params: { id: string } }) {
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
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const body = (await request.json()) as { avatar?: string | null };
    const avatar = (body.avatar || '').trim();

    if (!avatar || !isValidImageUrl(avatar)) {
      return NextResponse.json({ success: false, error: 'Please provide a valid image URL' }, { status: 400 });
    }

    const employee = await prisma.employee.updateMany({
      where: {
        id: context.params.id,
        tenantId: user.tenantId,
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
