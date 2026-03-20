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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch employees for tenant
    const employees = await prisma.employee.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: { select: { title: true } },
        department: { select: { name: true } },
        location: { select: { name: true } },
        employmentStatus: true,
        hireDate: true,
        avatar: true,
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Fetch stats
    const totalHeadcount = await prisma.employee.count({
      where: {
        tenantId: actor.tenantId,
        employmentStatus: 'ACTIVE',
      },
    });

    const leaveRequestsPending = await prisma.leaveRequest.count({
      where: {
        tenantId: actor.tenantId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        employees,
        stats: {
          totalHeadcount,
          activeLeavePending: leaveRequestsPending,
          pendingPayroll: 0,
          attritionRate: 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch data' 
      },
      { status: 500 }
    );
  }
}
