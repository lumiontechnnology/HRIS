import { auth } from '@clerk/nextjs';
import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
      include: { tenant: true },
    });

    if (!user || !user.tenantId) {
      return NextResponse.json(
        { 
          success: true, 
          data: {
            employees: [],
            stats: {
              totalHeadcount: 0,
              activeLeavePending: 0,
              pendingPayroll: 0,
              attritionRate: 0,
            },
          } 
        }
      );
    }

    // Fetch employees for tenant
    const employees = await prisma.employee.findMany({
      where: { tenantId: user.tenantId },
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
        tenantId: user.tenantId,
        employmentStatus: 'ACTIVE',
      },
    });

    const leaveRequestsPending = await prisma.leaveRequest.count({
      where: {
        tenantId: user.tenantId,
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
