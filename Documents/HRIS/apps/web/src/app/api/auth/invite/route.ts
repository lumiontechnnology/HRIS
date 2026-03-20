import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';
import { inviteEmployeeToTenant } from '@/lib/auth/invite';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.string().default('EMPLOYEE'),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthedUserWithTenant(req);
    if (!actor) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    if (!['SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR'].includes(actor.role)) {
      return NextResponse.json({ success: false, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const payload = inviteSchema.parse(await req.json());

    const result = await inviteEmployeeToTenant({
      tenantId: actor.tenantId,
      invitedByUserId: actor.id,
      email: payload.email,
      fullName: payload.fullName,
      role: payload.role,
      departmentId: payload.departmentId,
      managerId: payload.managerId,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid payload', details: error.errors } }, { status: 400 });
    }

    console.error('invite error', error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Invite failed' } },
      { status: 500 }
    );
  }
}
