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
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: actor.tenantId,
        employmentStatus: 'ACTIVE',
      },
      select: {
        id: true,
        managerId: true,
        firstName: true,
        lastName: true,
        avatar: true,
        jobTitle: { select: { title: true } },
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const mapped = employees.map((item) => ({
      id: item.id,
      managerId: item.managerId,
      name: `${item.firstName} ${item.lastName}`.trim(),
      role: item.jobTitle?.title || 'Not Assigned',
      department: item.department?.name || 'Unassigned',
      avatar: item.avatar,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Error loading org chart:', error);
    return NextResponse.json(
      { success: false, error: { code: 'ORG_CHART_FETCH_FAILED', message: 'Failed to fetch org chart data' } },
      { status: 500 }
    );
  }
}
