import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main(): Promise<void> {
  console.log('Starting seed...');

  // Create a test tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'lumion-tech' },
    update: {},
    create: {
      name: 'Lumion Technology',
      slug: 'lumion-tech',
      email: 'admin@lumiontech.com',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
    },
  });

  console.log('Created tenant:', tenant.id);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "WorkSchedule" (
        "id", "tenantId", "workDays", "workStart", "workEnd", "graceMinutes", "overtimeAfter", "updatedAt"
      ) VALUES ($1, $2, ARRAY['MON','TUE','WED','THU','FRI'], '08:00', '17:00', 15, 8.0, now())
      ON CONFLICT ("tenantId") DO UPDATE
      SET "workDays" = EXCLUDED."workDays",
          "workStart" = EXCLUDED."workStart",
          "workEnd" = EXCLUDED."workEnd",
          "graceMinutes" = EXCLUDED."graceMinutes",
          "overtimeAfter" = EXCLUDED."overtimeAfter",
          "updatedAt" = now()`,
    `ws_${tenant.id.slice(0, 12)}`,
    tenant.id
  );

  console.log('Seeded default work schedule');

  // Create locations
  const lagoLocation = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'LAG' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Lagos Office',
      code: 'LAG',
      city: 'Lagos',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
    },
  });

  const abujLocation = await prisma.location.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ABJ' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Abuja Office',
      code: 'ABJ',
      city: 'Abuja',
      country: 'Nigeria',
      timezone: 'Africa/Lagos',
    },
  });

  console.log('Created locations');

  // Create departments
  const hrDept = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Human Resources',
      code: 'HR',
    },
  });

  const engineeringDept = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ENG' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Engineering',
      code: 'ENG',
    },
  });

  const salesDept = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SALES' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales',
      code: 'SALES',
    },
  });

  console.log('Created departments');

  // Create job titles
  const ctoTitle = await prisma.jobTitle.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CTO' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Chief Technology Officer',
      code: 'CTO',
      departmentId: engineeringDept.id,
    },
  });

  const seniorEngineerTitle = await prisma.jobTitle.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SR_ENG' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Senior Engineer',
      code: 'SR_ENG',
      departmentId: engineeringDept.id,
    },
  });

  const hrManagerTitle = await prisma.jobTitle.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'HR_MGR' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'HR Manager',
      code: 'HR_MGR',
      departmentId: hrDept.id,
    },
  });

  const salesManagerTitle = await prisma.jobTitle.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SALES_MGR' } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Sales Manager',
      code: 'SALES_MGR',
      departmentId: salesDept.id,
    },
  });

  console.log('Created job titles');

  // Create super admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@lumiontech.com' },
    update: {},
    create: {
      authUserId: 'auth_admin_lumion',
      email: 'admin@lumiontech.com',
      firstName: 'Admin',
      lastName: 'User',
      tenantId: tenant.id,
      isActive: true,
    },
  });

  console.log('Created admin user');

  // Create CTO employee (first let's create them without manager)
  const ctoEmployee = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'cto@lumiontech.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0001',
      firstName: 'John',
      lastName: 'Okonkwo',
      email: 'cto@lumiontech.com',
      phone: '+2348000000001',
      hireDate: new Date('2022-01-15'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      jobTitleId: ctoTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      salary: 5000000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  // Create other employees with CTO as manager
  const seniorEngineer1 = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'chioma.adeyemi@lumiontech.com' } },
    update: {
      managerId: ctoEmployee.id,
      employmentStatus: 'ACTIVE',
      terminationDate: null,
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      salary: 3000000,
    },
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0002',
      firstName: 'Chioma',
      lastName: 'Adeyemi',
      email: 'chioma.adeyemi@lumiontech.com',
      phone: '+2348000000002',
      hireDate: new Date('2022-06-01'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      managerId: ctoEmployee.id,
      salary: 3000000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  const seniorEngineer2 = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'tunde.okafor@lumiontech.com' } },
    update: {
      managerId: ctoEmployee.id,
      employmentStatus: 'ACTIVE',
      terminationDate: null,
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      salary: 2800000,
    },
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0003',
      firstName: 'Tunde',
      lastName: 'Okafor',
      email: 'tunde.okafor@lumiontech.com',
      phone: '+2348000000003',
      hireDate: new Date('2023-02-01'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      managerId: ctoEmployee.id,
      salary: 2800000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  const hrManager = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'blessing.okafor@lumiontech.com' } },
    update: {
      employmentStatus: 'ACTIVE',
      terminationDate: null,
      jobTitleId: hrManagerTitle.id,
      departmentId: hrDept.id,
      locationId: lagoLocation.id,
      salary: 2200000,
    },
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0004',
      firstName: 'Blessing',
      lastName: 'Okafor',
      email: 'blessing.okafor@lumiontech.com',
      phone: '+2348000000004',
      hireDate: new Date('2022-03-15'),
      confirmationDate: new Date('2022-06-15'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      jobTitleId: hrManagerTitle.id,
      departmentId: hrDept.id,
      locationId: lagoLocation.id,
      salary: 2200000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  const salesManager = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'amara.ngoako@lumiontech.com' } },
    update: {
      employmentStatus: 'ACTIVE',
      terminationDate: null,
      jobTitleId: salesManagerTitle.id,
      departmentId: salesDept.id,
      locationId: abujLocation.id,
      salary: 2500000,
    },
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0005',
      firstName: 'Amara',
      lastName: 'Ngoako',
      email: 'amara.ngoako@lumiontech.com',
      phone: '+2348000000005',
      hireDate: new Date('2023-01-10'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      jobTitleId: salesManagerTitle.id,
      departmentId: salesDept.id,
      locationId: abujLocation.id,
      salary: 2500000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  const exitedEngineer = await prisma.employee.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'emeka.eze@lumiontech.com' } },
    update: {
      employmentStatus: 'EXITED',
      terminationDate: toDateOnly('2026-03-15'),
      managerId: ctoEmployee.id,
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      salary: 3000000,
    },
    create: {
      tenantId: tenant.id,
      employeeId: 'LMN-0042',
      firstName: 'Emeka',
      lastName: 'Eze',
      email: 'emeka.eze@lumiontech.com',
      phone: '+2348000000042',
      hireDate: new Date('2019-06-03'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'EXITED',
      terminationDate: toDateOnly('2026-03-15'),
      jobTitleId: seniorEngineerTitle.id,
      departmentId: engineeringDept.id,
      locationId: lagoLocation.id,
      managerId: ctoEmployee.id,
      salary: 3000000,
      currency: 'NGN',
      salaryFrequency: 'MONTHLY',
    },
  });

  console.log('Created employees');

  // Create leave types
  const annualLeave = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'ANNUAL' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Annual Leave',
      code: 'ANNUAL',
      requiresApproval: true,
      maxConsecutiveDays: 30,
      carryoverLimit: 5,
      carryoverExpiry: 365,
    },
  });

  const sickLeave = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SICK' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sick Leave',
      code: 'SICK',
      requiresApproval: true,
      requiresDocumentation: true,
      maxConsecutiveDays: 5,
    },
  });

  const maternityLeave = await prisma.leaveType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MATERNITY' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Maternity Leave',
      code: 'MATERNITY',
      requiresApproval: true,
      isGenderRestricted: true,
      maxConsecutiveDays: 90,
    },
  });

  console.log('Created leave types');

  // Create leave balances for employees
  const currentYear = new Date().getFullYear();
  
  await prisma.leaveBalance.upsert({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: ctoEmployee.id,
        leaveTypeId: annualLeave.id,
        year: currentYear,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      employeeId: ctoEmployee.id,
      leaveTypeId: annualLeave.id,
      year: currentYear,
      available: 21,
      taken: 0,
      carried: 0,
    },
  });

  const seededEmployees = [
    ctoEmployee,
    seniorEngineer1,
    seniorEngineer2,
    hrManager,
    salesManager,
    exitedEngineer,
  ];

  for (const employee of seededEmployees) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EmploymentHistory" (
          "id", "tenantId", "employeeId", "stintNumber", "hireDate", "exitDate", "exitType", "jobTitle", "department", "finalSalary", "notes", "createdAt"
        )
        SELECT $1, $2, $3, 1, $4::date, $5::date, $6, $7, $8, $9, $10, now()
        WHERE NOT EXISTS (
          SELECT 1 FROM "EmploymentHistory"
          WHERE "employeeId" = $3 AND "stintNumber" = 1
        )`,
      `eh_${employee.id.slice(0, 16)}`,
      tenant.id,
      employee.id,
      employee.hireDate.toISOString().slice(0, 10),
      employee.terminationDate ? employee.terminationDate.toISOString().slice(0, 10) : null,
      employee.terminationDate ? 'RESIGNATION' : null,
      employee.id === hrManager.id ? 'HR Manager' : employee.id === salesManager.id ? 'Sales Manager' : 'Senior Engineer',
      employee.id === hrManager.id ? 'Human Resources' : employee.id === salesManager.id ? 'Sales' : 'Engineering',
      Number(employee.salary),
      employee.terminationDate ? 'Exited profile seeded for registry flow' : 'Active employment seeded'
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "EmployeeExit" (
        "id", "tenantId", "employeeId", "exitType", "exitStatus", "noticeDate", "lastWorkingDay", "exitReason", "isEligibleRehire", "rehireNotes", "finalSettlementPaid", "finalSettlementDate", "finalSettlementAmount", "processedByUserId", "createdAt", "updatedAt"
      )
      SELECT $1, $2, $3, 'RESIGNATION', 'EXITED', '2026-02-28'::date, '2026-03-15'::date, 'Relocation', true, 'Strong prior performance', true, '2026-03-18'::date, 295568, $4, now(), now()
      WHERE NOT EXISTS (
        SELECT 1 FROM "EmployeeExit" WHERE "employeeId" = $3
      )`,
    `exit_${exitedEngineer.id.slice(0, 16)}`,
    tenant.id,
    exitedEngineer.id,
    adminUser.id
  );

  const offboardingTasks = [
    ['IT', 'Revoke system access', '2026-03-15'],
    ['IT', 'Collect company laptop', '2026-03-15'],
    ['HR', 'Conduct exit interview', '2026-03-12'],
    ['FINANCE', 'Process final payroll', '2026-03-22'],
    ['MANAGER', 'Collect project handover notes', '2026-03-10'],
  ];

  for (const [assigneeRole, title, dueDate] of offboardingTasks) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "OffboardingTask" (
          "id", "tenantId", "employeeId", "assigneeRole", "title", "dueDate", "status", "createdAt", "updatedAt"
        )
        SELECT $1, $2, $3, $4, $5, $6::date, 'PENDING', now(), now()
        WHERE NOT EXISTS (
          SELECT 1 FROM "OffboardingTask"
          WHERE "employeeId" = $3 AND "title" = $5
        )`,
      `ot_${exitedEngineer.id.slice(0, 8)}_${title.replace(/\s+/g, '_').toLowerCase()}`.slice(0, 32),
      tenant.id,
      exitedEngineer.id,
      assigneeRole,
      title,
      dueDate
    );
  }

  console.log('Seeded exits, employment history, and offboarding tasks');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
