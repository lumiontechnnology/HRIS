import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';
import { inviteEmployeeToTenant } from '@/lib/auth/invite';

const bulkSchema = z.object({
  emails: z.array(z.string().email()).min(1),
  role: z.string().default('EMPLOYEE'),
  departmentId: z.string().optional(),
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

    const payload = bulkSchema.parse(await req.json());
    const uniqueEmails = Array.from(new Set(payload.emails.map((email) => email.trim().toLowerCase())));

    const results: Array<{ email: string; success: boolean; message: string }> = [];

    for (const email of uniqueEmails) {
      try {
        await inviteEmployeeToTenant({
          tenantId: actor.tenantId,
          invitedByUserId: actor.id,
          email,
          fullName: email.split('@')[0].replace(/[._-]+/g, ' '),
          role: payload.role,
          departmentId: payload.departmentId,
        });
        results.push({ email, success: true, message: 'Invited' });
      } catch (error) {
        results.push({
          email,
          success: false,
          message: error instanceof Error ? error.message : 'Failed',
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;

    return NextResponse.json({
      success: true,
      data: {
        total: uniqueEmails.length,
        successCount,
        failedCount: uniqueEmails.length - successCount,
        results,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid payload', details: error.errors } }, { status: 400 });
    }

    console.error('invite-bulk error', error);
    return NextResponse.json({ success: false, error: { message: 'Bulk invite failed' } }, { status: 500 });
  }
}
