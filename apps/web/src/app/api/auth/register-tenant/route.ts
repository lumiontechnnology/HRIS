import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { createAdminClient } from '@/lib/supabase/admin';

const registerSchema = z.object({
  companyName: z.string().min(2),
  industry: z.enum(['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Education', 'Retail', 'NGO', 'Government', 'Other']),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']),
  country: z.enum(['Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Other']).default('Nigeria'),
  fullName: z.string().min(2),
  workEmail: z.string().email(),
  password: z.string().min(8).regex(/\d/, 'Password must include at least one number'),
  confirmPassword: z.string(),
  agreedToTerms: z.literal(true),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function slugifyCompanyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function buildUniqueSlug(companyName: string): Promise<string> {
  const base = slugifyCompanyName(companyName) || 'tenant';
  let slug = base;
  let index = 1;

  while (await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) {
    index += 1;
    slug = `${base}-${index}`;
  }

  return slug;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || 'Admin',
    lastName: rest.join(' ') || 'User',
  };
}

async function sendWelcomeEmail(email: string, companyName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Welcome email skipped: RESEND_API_KEY is not configured', {
      recipient: email,
      companyName,
    });
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.SMTP_FROM || 'Lumion HRIS <noreply@lumionhris.com>',
      to: email,
      subject: `Welcome to ${companyName} on Lumion HRIS`,
      html: `<p>Your workspace has been created. Sign in to continue setup.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login">Open Lumion HRIS</a></p>`,
    });
  } catch (error) {
    console.error('Failed to send welcome email', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = registerSchema.parse(await req.json());
    const email = payload.workEmail.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ success: false, error: { message: 'Email is already in use' } }, { status: 409 });
    }

    const slug = await buildUniqueSlug(payload.companyName);
    const name = splitName(payload.fullName);

    const adminClient = createAdminClient();

    // Handle orphaned auth users from previous failed registration attempts
    let authUserId: string;
    const createResult = await adminClient.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        firstName: name.firstName,
        lastName: name.lastName,
      },
    });

    if (createResult.error) {
      // If user already exists in Supabase auth but not in our DB, reclaim it
      if (createResult.error.message?.includes('already been registered')) {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const orphan = listData?.users?.find((u) => u.email === email);
        if (!orphan) {
          return NextResponse.json(
            { success: false, error: { message: 'Email is already registered. Please sign in instead.' } },
            { status: 409 }
          );
        }
        // Update the orphaned auth user with fresh password and metadata
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(orphan.id, {
          password: payload.password,
          email_confirm: true,
          user_metadata: {
            full_name: payload.fullName,
            firstName: name.firstName,
            lastName: name.lastName,
          },
        });
        if (updateErr) {
          return NextResponse.json(
            { success: false, error: { message: updateErr.message || 'Failed to reclaim account' } },
            { status: 400 }
          );
        }
        authUserId = orphan.id;
      } else {
        return NextResponse.json(
          { success: false, error: { message: createResult.error.message || 'Failed to create account' } },
          { status: 400 }
        );
      }
    } else if (!createResult.data.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Failed to create account' } },
        { status: 400 }
      );
    } else {
      authUserId = createResult.data.user.id;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: payload.companyName.trim(),
        slug,
        industry: payload.industry,
        size: payload.companySize,
        country: payload.country,
        plan: 'trial',
        status: 'active',
        onboardingComplete: false,
      },
    });

    const superAdminRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'SUPER_ADMIN' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'SUPER_ADMIN',
        description: 'Tenant owner and primary administrator',
        isBuiltIn: true,
      },
    });

    const employeeRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'EMPLOYEE' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'EMPLOYEE',
        description: 'Default employee role',
        isBuiltIn: true,
      },
    });

    const [department, location, jobTitle] = await Promise.all([
      prisma.department.create({
        data: {
          tenantId: tenant.id,
          name: 'Operations',
          code: 'OPS',
        },
      }),
      prisma.location.create({
        data: {
          tenantId: tenant.id,
          name: payload.country === 'Nigeria' ? 'Lagos Office' : `${payload.country} Office`,
          code: 'HQ',
          country: payload.country,
          city: payload.country === 'Nigeria' ? 'Lagos' : payload.country,
          timezone: 'Africa/Lagos',
        },
      }),
      prisma.jobTitle.create({
        data: {
          tenantId: tenant.id,
          title: 'Super Admin',
          code: 'SUPER_ADMIN',
        },
      }),
    ]);

    const appUser = await prisma.user.create({
      data: {
        authUserId: authUserId,
        email,
        firstName: name.firstName,
        lastName: name.lastName,
        tenantId: tenant.id,
        roles: {
          connect: [{ id: superAdminRole.id }],
        },
      },
    });

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        employeeId: 'LMN-0001',
        firstName: name.firstName,
        lastName: name.lastName,
        email,
        hireDate: new Date(),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        salary: 0,
        currency: 'NGN',
        salaryFrequency: 'MONTHLY',
        departmentId: department.id,
        locationId: location.id,
        jobTitleId: jobTitle.id,
        user: {
          connect: { id: appUser.id },
        },
      },
    });

    await prisma.workSchedule.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        workStart: '08:00',
        workEnd: '17:00',
        graceMinutes: 15,
        timezone: 'Africa/Lagos',
      },
    });

    await prisma.leaveType.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Annual Leave',
          code: 'ANNUAL',
          maxConsecutiveDays: 20,
          requiresApproval: true,
        },
        {
          tenantId: tenant.id,
          name: 'Sick Leave',
          code: 'SICK',
          maxConsecutiveDays: 10,
          requiresApproval: true,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: appUser.id,
        action: 'CREATE',
        resource: 'tenant',
        resourceId: tenant.id,
        changes: {
          tenantName: tenant.name,
          role: 'SUPER_ADMIN',
          bootstrapEmployeeId: employee.id,
          seededRoles: [superAdminRole.name, employeeRole.name],
        },
      },
    });

    await sendWelcomeEmail(email, tenant.name);

    return NextResponse.json({ success: true, redirectTo: '/onboarding' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid payload', details: error.errors } }, { status: 400 });
    }

    console.error('register-tenant error', error);
    return NextResponse.json({ success: false, error: { message: 'Unable to create workspace' } }, { status: 500 });
  }
}
