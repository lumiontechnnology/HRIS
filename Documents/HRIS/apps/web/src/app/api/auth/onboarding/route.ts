import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumion/database';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

const companyProfileSchema = z.object({
  companyName: z.string().min(2),
  logoUrl: z.string().url().optional().or(z.literal('')),
  address: z.string().min(2),
  registrationNumber: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

const workScheduleSchema = z.object({
  workDays: z.array(z.string()).min(1),
  workStart: z.string().min(4),
  workEnd: z.string().min(4),
  graceMinutes: z.number().int().min(0).max(180),
  timezone: z.string().min(2),
});

const orgSetupSchema = z.object({
  departments: z.array(z.string().min(2)).min(1),
  locations: z.array(z.object({ name: z.string().min(2), city: z.string().min(2) })).min(1),
  jobTitles: z.array(z.string().min(2)).min(1),
});

const leavePoliciesSchema = z.object({
  annualLeaveDays: z.number().int().min(0).max(365),
  sickLeaveDays: z.number().int().min(0).max(365),
  extraLeaveTypes: z.array(z.object({ name: z.string().min(2), days: z.number().int().min(0).max(365) })).default([]),
});

const bodySchema = z.discriminatedUnion('step', [
  z.object({ step: z.literal('company_profile'), payload: companyProfileSchema }),
  z.object({ step: z.literal('work_schedule'), payload: workScheduleSchema }),
  z.object({ step: z.literal('org_setup'), payload: orgSetupSchema }),
  z.object({ step: z.literal('leave_policies'), payload: leavePoliciesSchema }),
  z.object({ step: z.literal('complete'), payload: z.object({}) }),
]);

function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'ITEM';
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthedUserWithTenant(req);
    if (!actor) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    if (actor.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: { message: 'Only SUPER_ADMIN can complete onboarding' } }, { status: 403 });
    }

    const body = bodySchema.parse(await req.json());

    if (body.step === 'company_profile') {
      await prisma.tenant.update({
        where: { id: actor.tenantId },
        data: {
          name: body.payload.companyName,
          logo: body.payload.logoUrl || null,
          address: body.payload.address,
          registrationNumber: body.payload.registrationNumber || null,
          fiscalYearStartMonth: body.payload.fiscalYearStartMonth,
        },
      });
    }

    if (body.step === 'work_schedule') {
      await prisma.workSchedule.upsert({
        where: { tenantId: actor.tenantId },
        update: {
          workDays: body.payload.workDays,
          workStart: body.payload.workStart,
          workEnd: body.payload.workEnd,
          graceMinutes: body.payload.graceMinutes,
          timezone: body.payload.timezone,
        },
        create: {
          tenantId: actor.tenantId,
          workDays: body.payload.workDays,
          workStart: body.payload.workStart,
          workEnd: body.payload.workEnd,
          graceMinutes: body.payload.graceMinutes,
          timezone: body.payload.timezone,
        },
      });
    }

    if (body.step === 'org_setup') {
      for (const departmentName of body.payload.departments) {
        const codeBase = normalizeCode(departmentName);
        const existing = await prisma.department.findFirst({
          where: { tenantId: actor.tenantId, code: codeBase },
          select: { id: true },
        });

        await prisma.department.create({
          data: {
            tenantId: actor.tenantId,
            name: departmentName,
            code: existing ? `${codeBase}_${Date.now().toString().slice(-4)}` : codeBase,
          },
        });
      }

      for (const location of body.payload.locations) {
        const codeBase = normalizeCode(location.name).slice(0, 10);
        const existing = await prisma.location.findFirst({
          where: { tenantId: actor.tenantId, code: codeBase },
          select: { id: true },
        });

        await prisma.location.create({
          data: {
            tenantId: actor.tenantId,
            name: location.name,
            code: existing ? `${codeBase}${Date.now().toString().slice(-2)}` : codeBase,
            city: location.city,
            country: 'Nigeria',
            timezone: 'Africa/Lagos',
          },
        });
      }

      const defaultDepartment = await prisma.department.findFirst({ where: { tenantId: actor.tenantId }, orderBy: { createdAt: 'asc' } });

      for (const title of body.payload.jobTitles) {
        const codeBase = normalizeCode(title);
        const existing = await prisma.jobTitle.findFirst({
          where: { tenantId: actor.tenantId, code: codeBase },
          select: { id: true },
        });

        await prisma.jobTitle.create({
          data: {
            tenantId: actor.tenantId,
            title,
            code: existing ? `${codeBase}_${Date.now().toString().slice(-4)}` : codeBase,
            departmentId: defaultDepartment?.id,
          },
        });
      }
    }

    if (body.step === 'leave_policies') {
      const leaveTypes = [
        { code: 'ANNUAL', name: 'Annual Leave', days: body.payload.annualLeaveDays },
        { code: 'SICK', name: 'Sick Leave', days: body.payload.sickLeaveDays },
        ...body.payload.extraLeaveTypes.map((item) => ({
          code: normalizeCode(item.name),
          name: item.name,
          days: item.days,
        })),
      ];

      for (const leave of leaveTypes) {
        await prisma.leaveType.upsert({
          where: { tenantId_code: { tenantId: actor.tenantId, code: leave.code } },
          update: {
            name: leave.name,
            maxConsecutiveDays: leave.days,
            requiresApproval: true,
          },
          create: {
            tenantId: actor.tenantId,
            name: leave.name,
            code: leave.code,
            maxConsecutiveDays: leave.days,
            requiresApproval: true,
          },
        });
      }
    }

    if (body.step === 'complete') {
      await prisma.tenant.update({
        where: { id: actor.tenantId },
        data: { onboardingComplete: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Invalid payload', details: error.errors } }, { status: 400 });
    }

    console.error('onboarding error', error);
    return NextResponse.json({ success: false, error: { message: 'Onboarding update failed' } }, { status: 500 });
  }
}
