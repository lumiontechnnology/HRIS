import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  const seniorEngineer1 = await prisma.employee.create({
    data: {
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

  const seniorEngineer2 = await prisma.employee.create({
    data: {
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

  const hrManager = await prisma.employee.create({
    data: {
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

  const salesManager = await prisma.employee.create({
    data: {
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
