import { prisma } from '@lumion/database';
import { createAdminClient } from '@/lib/supabase/admin';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toNameParts(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: 'Team', lastName: 'Member' };
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return { firstName, lastName: rest.join(' ') || 'Member' };
}

async function nextEmployeeCode(tenantId: string): Promise<string> {
  const count = await prisma.employee.count({ where: { tenantId } });
  return `LMN-${String(count + 1).padStart(4, '0')}`;
}

async function resolveDefaultOrgIds(tenantId: string) {
  const [department, location, jobTitle] = await Promise.all([
    prisma.department.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
    prisma.location.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
    prisma.jobTitle.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } }),
  ]);

  if (!department || !location || !jobTitle) {
    throw new Error('Complete onboarding setup first: department, location, and job title are required.');
  }

  return {
    departmentId: department.id,
    locationId: location.id,
    jobTitleId: jobTitle.id,
  };
}

export interface InviteEmployeeInput {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  fullName: string;
  role: string;
  departmentId?: string;
  managerId?: string;
}

export async function inviteEmployeeToTenant(input: InviteEmployeeInput): Promise<{ userId: string; employeeId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(`Invalid email: ${input.email}`);
  }

  const roleName = input.role.trim().toUpperCase() || 'EMPLOYEE';
  const nameParts = toNameParts(input.fullName);
  const orgDefaults = await resolveDefaultOrgIds(input.tenantId);

  const supabaseAdmin = createAdminClient();
  const inviteResult = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      tenant_id: input.tenantId,
      tenantId: input.tenantId,
      role: roleName,
      roles: [roleName],
      full_name: input.fullName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
    },
  });

  if (inviteResult.error || !inviteResult.data.user?.id) {
    throw new Error(inviteResult.error?.message || 'Failed to send invitation email');
  }

  const authUserId = inviteResult.data.user.id;

  const role = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: input.tenantId, name: roleName } },
    update: {},
    create: {
      tenantId: input.tenantId,
      name: roleName,
      description: `System role: ${roleName}`,
      isBuiltIn: true,
    },
  });

  const appUser = await prisma.user.upsert({
    where: { authUserId },
    update: {
      email,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      tenantId: input.tenantId,
      roles: {
        set: [],
        connect: [{ id: role.id }],
      },
    },
    create: {
      authUserId,
      email,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      tenantId: input.tenantId,
      roles: {
        connect: [{ id: role.id }],
      },
    },
    include: { employee: true },
  });

  const employee = appUser.employee
    ? await prisma.employee.update({
        where: { id: appUser.employee.id },
        data: {
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          email,
          departmentId: input.departmentId || orgDefaults.departmentId,
          managerId: input.managerId || null,
          jobTitleId: orgDefaults.jobTitleId,
          locationId: orgDefaults.locationId,
        },
      })
    : await prisma.employee.create({
        data: {
          tenantId: input.tenantId,
          employeeId: await nextEmployeeCode(input.tenantId),
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          email,
          hireDate: new Date(),
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          salary: 0,
          currency: 'NGN',
          salaryFrequency: 'MONTHLY',
          departmentId: input.departmentId || orgDefaults.departmentId,
          managerId: input.managerId || null,
          jobTitleId: orgDefaults.jobTitleId,
          locationId: orgDefaults.locationId,
          user: {
            connect: { id: appUser.id },
          },
        },
      });

  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.invitedByUserId,
      action: 'CREATE',
      resource: 'employee_invite',
      resourceId: employee.id,
      changes: {
        email,
        role: roleName,
      },
    },
  });

  return { userId: appUser.id, employeeId: employee.id };
}
