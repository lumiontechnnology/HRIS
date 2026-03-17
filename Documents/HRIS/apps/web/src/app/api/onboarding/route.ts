import { auth } from '@clerk/nextjs';
import { PrismaClient } from '@lumion/database';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// POST /api/onboarding - Save onboarding form data
export async function POST(request: Request) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { department, position, startDate, phone } = body;

    // Validate required fields
    if (!department || !position || !startDate || !phone) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: department, position, startDate, phone' 
        },
        { status: 400 }
      );
    }

    // Get the user from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get or create tenant (for now, we'll use a default tenant)
    // In a multi-tenant app, this would be determined by the user's organization
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'default' },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'My Company',
          slug: 'default',
          timezone: 'UTC',
        },
      });
    }

    // Get or create department
    let departmentRecord = await prisma.department.findFirst({
      where: { 
        tenantId: tenant.id,
        name: department,
      },
    });

    if (!departmentRecord) {
      departmentRecord = await prisma.department.create({
        data: {
          tenantId: tenant.id,
          name: department,
          code: department.substring(0, 3).toUpperCase(),
        },
      });
    }

    // Get or create job title
    let jobTitleRecord = await prisma.jobTitle.findFirst({
      where: {
        tenantId: tenant.id,
        title: position,
      },
    });

    if (!jobTitleRecord) {
      jobTitleRecord = await prisma.jobTitle.create({
        data: {
          tenantId: tenant.id,
          title: position,
          description: position,
        },
      });
    }

    // Get default location
    let location = await prisma.location.findFirst({
      where: { tenantId: tenant.id },
    });

    if (!location) {
      location = await prisma.location.create({
        data: {
          tenantId: tenant.id,
          name: 'Headquarters',
          code: 'HQ',
          country: 'NG',
        },
      });
    }

    // Create or update employee record
    const employee = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {
        phone,
        hireDate: new Date(startDate),
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        employeeId: `LMN-${String(user.id.length).padStart(4, '0')}`,
        firstName: user.firstName || 'First',
        lastName: user.lastName || 'Last',
        email: user.email,
        phone,
        jobTitleId: jobTitleRecord.id,
        departmentId: departmentRecord.id,
        locationId: location.id,
        hireDate: new Date(startDate),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        salary: 0,
        currency: 'NGN',
      },
    });

    // Update user's tenant ID
    await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: tenant.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        employeeId: employee.id,
        message: 'Onboarding completed successfully',
      },
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to complete onboarding' 
      },
      { status: 500 }
    );
  }
}
