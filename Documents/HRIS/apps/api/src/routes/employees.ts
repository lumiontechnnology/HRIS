import { Hono } from 'hono';
import { prisma } from '@lumion/database';
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
  PaginationSchema,
} from '@lumion/validators';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../index.js';
import { getRolesFromContext, requireAnyRole } from '../lib/auth/rbac.js';

const EXIT_TYPES = [
  'RESIGNATION',
  'TERMINATION',
  'REDUNDANCY',
  'RETIREMENT',
  'CONTRACT_END',
  'DEATH',
  'ABANDONMENT',
  'MUTUAL_AGREEMENT',
] as const;

const ExitEmployeeSchema = z.object({
  exitType: z.enum(EXIT_TYPES),
  noticeDate: z.string().date(),
  lastWorkingDay: z.string().date(),
  exitReason: z.string().trim().max(1000).optional(),
  exitInterviewNotes: z.string().trim().max(2000).optional(),
  isEligibleRehire: z.boolean().optional(),
  rehireNotes: z.string().trim().max(1000).optional(),
});

const RehireEmployeeSchema = z.object({
  newHireDate: z.string().date(),
  newJobTitle: z.string().min(1),
  newDepartment: z.string().min(1),
  newSalary: z.number().positive(),
  newManagerId: z.string().optional(),
  rehireReason: z.string().trim().min(3).max(1000),
});

const OFFBOARDING_TASKS: Array<{ assigneeRole: string; title: string; dueDays: number }> = [
  { assigneeRole: 'IT', title: 'Revoke system access', dueDays: 0 },
  { assigneeRole: 'IT', title: 'Collect company laptop', dueDays: 0 },
  { assigneeRole: 'IT', title: 'Collect access card/key fob', dueDays: 0 },
  { assigneeRole: 'HR', title: 'Conduct exit interview', dueDays: -3 },
  { assigneeRole: 'HR', title: 'Process final settlement', dueDays: 7 },
  { assigneeRole: 'HR', title: 'Issue experience letter', dueDays: 7 },
  { assigneeRole: 'HR', title: 'Update pension remittance', dueDays: 30 },
  { assigneeRole: 'FINANCE', title: 'Process final payroll', dueDays: 7 },
  { assigneeRole: 'FINANCE', title: 'Settle expense claims', dueDays: 7 },
  { assigneeRole: 'MANAGER', title: 'Collect project handover notes', dueDays: -5 },
  { assigneeRole: 'MANAGER', title: 'Update team task assignments', dueDays: 0 },
  { assigneeRole: 'EMPLOYEE', title: 'Return all company property', dueDays: 0 },
  { assigneeRole: 'EMPLOYEE', title: 'Hand over ongoing projects', dueDays: -3 },
];

const CSV_COLUMNS = [
  'employee_id',
  'first_name',
  'middle_name',
  'last_name',
  'email',
  'personal_email',
  'phone',
  'date_of_birth',
  'gender',
  'marital_status',
  'nationality',
  'national_id',
  'hire_date',
  'employment_type',
  'job_title',
  'department',
  'location',
  'manager_email',
  'salary',
  'currency',
  'salary_frequency',
  'address_street',
  'address_city',
  'address_state',
  'address_country',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relationship',
  'bank_name',
  'account_number',
  'account_name',
  'sort_code',
];

type CsvRow = Record<string, string>;

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows: CsvRow[]): string {
  const header = CSV_COLUMNS.join(',');
  const data = rows.map((row) => CSV_COLUMNS.map((column) => escapeCsv(row[column] || '')).join(','));
  return [header, ...data].join('\n');
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = lines[0]
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/\s+/g, '_'));

  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const values = line.split(',').map((item) => item.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

export function createEmployeeRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // ========================================================================
  // GET /api/v1/employees - List all employees
  // ========================================================================
  app.get('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const roles = getRolesFromContext(c);

      // Parse query params
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '20');
      const sortBy = c.req.query('sortBy') || 'createdAt';
      const order = (c.req.query('order') || 'desc') as 'asc' | 'desc';
      const includeExited = c.req.query('includeExited') === 'true';
      const statusFilter = c.req.query('status');

      // Validate pagination
      const validPagination = PaginationSchema.parse({ page, limit, sortBy, order });

      const skip = (validPagination.page - 1) * validPagination.limit;
      const where: Record<string, unknown> = { tenantId };
      if (statusFilter) {
        where.employmentStatus = statusFilter;
      } else if (!includeExited) {
        where.employmentStatus = { notIn: ['EXITED'] };
      }

      // Fetch employees
      const managerEmployee = roles.includes('MANAGER')
        ? await prisma.employee.findFirst({ where: { tenantId, userId } })
        : null;

      const scopedWhere = {
        ...where,
        ...(roles.includes('MANAGER') && managerEmployee ? { managerId: managerEmployee.id } : {}),
      };

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where: scopedWhere,
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: { select: { title: true } },
            department: { select: { name: true } },
            location: { select: { name: true } },
            manager: { select: { firstName: true, lastName: true } },
            employmentStatus: true,
            hireDate: true,
            avatar: true,
          },
          orderBy: { [sortBy]: order },
          skip,
          take: validPagination.limit,
        }),
        prisma.employee.count({ where: scopedWhere }),
      ]);

      return c.json({
        success: true,
        data: employees,
        meta: {
          page: validPagination.page,
          limit: validPagination.limit,
          total,
          hasMore: skip + employees.length < total,
        },
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      return c.json(
        { success: false, error: 'Failed to fetch employees' },
        500
      );
    }
  });

  // ========================================================================
  // POST /api/v1/employees - Create employee
  // ========================================================================
  app.post('/', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const body = await c.req.json();

      // Validate input
      const validData = EmployeeCreateSchema.parse(body);

      // Generate employee ID
      const existingCount = await prisma.employee.count({
        where: { tenantId },
      });
      const employeeId = `LMN-${String(existingCount + 1).padStart(4, '0')}`;

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          tenantId,
          employeeId,
          ...validData,
        },
      });

      return c.json(
        {
          success: true,
          data: employee,
          message: 'Employee created successfully',
        },
        201
      );
    } catch (error: any) {
      console.error('Error creating employee:', error);

      if (error.name === 'ZodError') {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: error.errors,
            },
          },
          400
        );
      }

      return c.json(
        { success: false, error: 'Failed to create employee' },
        500
      );
    }
  });

  app.get('/export', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const tenantId = c.get('tenantId');

    const employees = await prisma.employee.findMany({
      where: { tenantId, employmentStatus: 'ACTIVE' },
      include: {
        jobTitle: { select: { title: true } },
        department: { select: { name: true } },
        location: { select: { name: true } },
        manager: { select: { email: true } },
        addresses: true,
        emergencyContacts: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows: CsvRow[] = employees.map((employee) => ({
      employee_id: employee.employeeId,
      first_name: employee.firstName,
      middle_name: employee.middleName || '',
      last_name: employee.lastName,
      email: employee.email,
      personal_email: employee.personalEmail || '',
      phone: employee.phone || '',
      date_of_birth: employee.dateOfBirth ? employee.dateOfBirth.toISOString().slice(0, 10) : '',
      gender: employee.gender || '',
      marital_status: employee.maritalStatus || '',
      nationality: employee.nationality || '',
      national_id: employee.nationalId || '',
      hire_date: employee.hireDate.toISOString().slice(0, 10),
      employment_type: employee.employmentType,
      job_title: employee.jobTitle?.title || '',
      department: employee.department?.name || '',
      location: employee.location?.name || '',
      manager_email: employee.manager?.email || '',
      salary: String(employee.salary),
      currency: employee.currency,
      salary_frequency: employee.salaryFrequency,
      address_street: employee.addresses[0]?.streetAddress || '',
      address_city: employee.addresses[0]?.city || '',
      address_state: employee.addresses[0]?.state || '',
      address_country: employee.addresses[0]?.country || '',
      emergency_contact_name: employee.emergencyContacts[0]?.name || '',
      emergency_contact_phone: employee.emergencyContacts[0]?.phone || '',
      emergency_contact_relationship: employee.emergencyContacts[0]?.relationship || '',
      bank_name: '',
      account_number: '',
      account_name: '',
      sort_code: '',
    }));

    const csv = toCsv(rows);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="lumion-employees-${date}.csv"`,
      },
    });
  });

  app.get('/template', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    const examples: CsvRow[] = [
      {
        employee_id: 'LMN-1001',
        first_name: 'Adaeze',
        middle_name: 'Ifeoma',
        last_name: 'Okafor',
        email: 'adaeze.okafor@lumionhris.com',
        personal_email: 'adaeze.okafor@gmail.com',
        phone: '+2348012345678',
        date_of_birth: '1993-04-09',
        gender: 'FEMALE',
        marital_status: 'MARRIED',
        nationality: 'Nigerian',
        national_id: 'NIN-12345678901',
        hire_date: '2026-03-10',
        employment_type: 'FULL_TIME',
        job_title: 'Senior Software Engineer',
        department: 'Engineering',
        location: 'Lagos',
        manager_email: '',
        salary: '1200000',
        currency: 'NGN',
        salary_frequency: 'MONTHLY',
        address_street: '12 Admiralty Way',
        address_city: 'Lagos',
        address_state: 'Lagos',
        address_country: 'Nigeria',
        emergency_contact_name: 'Chinedu Okafor',
        emergency_contact_phone: '+2348098765432',
        emergency_contact_relationship: 'Spouse',
        bank_name: 'GTBank',
        account_number: '0123456789',
        account_name: 'Adaeze Okafor',
        sort_code: '058152036',
      },
      {
        employee_id: '',
        first_name: 'Chinonso',
        middle_name: '',
        last_name: 'Eze',
        email: 'chinonso.eze@lumionhris.com',
        personal_email: '',
        phone: '',
        date_of_birth: '',
        gender: 'MALE',
        marital_status: '',
        nationality: '',
        national_id: '',
        hire_date: '2026-03-12',
        employment_type: 'FULL_TIME',
        job_title: 'Product Designer',
        department: 'Design',
        location: 'Abuja',
        manager_email: '',
        salary: '850000',
        currency: 'NGN',
        salary_frequency: 'MONTHLY',
        address_street: '',
        address_city: '',
        address_state: '',
        address_country: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        sort_code: '',
      },
      {
        employee_id: 'LMN-1003',
        first_name: 'Bamidele',
        middle_name: '',
        last_name: 'Akinola',
        email: 'bamidele.akinola@lumionhris.com',
        personal_email: '',
        phone: '+2348123456700',
        date_of_birth: '1996-11-21',
        gender: 'MALE',
        marital_status: 'SINGLE',
        nationality: 'Nigerian',
        national_id: '',
        hire_date: '2026-03-14',
        employment_type: 'INTERN',
        job_title: 'HR Intern',
        department: 'Human Resources',
        location: 'Lagos',
        manager_email: 'adaeze.okafor@lumionhris.com',
        salary: '220000',
        currency: 'NGN',
        salary_frequency: 'MONTHLY',
        address_street: '4 Marina Road',
        address_city: 'Lagos',
        address_state: 'Lagos',
        address_country: 'Nigeria',
        emergency_contact_name: 'Morayo Akinola',
        emergency_contact_phone: '+2348123456710',
        emergency_contact_relationship: 'Mother',
        bank_name: 'Access Bank',
        account_number: '1234567890',
        account_name: 'Bamidele Akinola',
        sort_code: '044150149',
      },
    ];

    const csv = toCsv(examples);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="lumion-employees-template.csv"',
      },
    });
  });

  app.post('/import', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');

      const body = await c.req.parseBody();
      const csvFile = body.csv;
      if (!(csvFile instanceof File)) {
        return c.json({ success: false, error: { code: 'INVALID_FILE', message: 'CSV file is required' } }, 400);
      }

      const rows = parseCsv(await csvFile.text());
      if (rows.length === 0) {
        return c.json({ success: false, error: { code: 'EMPTY_FILE', message: 'No rows found in CSV' } }, 400);
      }

      const [departments, jobTitles, locations, existingEmployees] = await Promise.all([
        prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        prisma.jobTitle.findMany({ where: { tenantId }, select: { id: true, title: true } }),
        prisma.location.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        prisma.employee.findMany({ where: { tenantId }, select: { id: true, email: true } }),
      ]);

      if (departments.length === 0 || jobTitles.length === 0 || locations.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: 'REFERENCE_DATA_MISSING',
              message: 'Departments, job titles, and locations must exist before import',
            },
          },
          400
        );
      }

      const departmentMap = new Map(departments.map((item) => [item.name.toLowerCase(), item.id]));
      const jobTitleMap = new Map(jobTitles.map((item) => [item.title.toLowerCase(), item.id]));
      const locationMap = new Map(locations.map((item) => [item.name.toLowerCase(), item.id]));
      const fallbackDepartmentId = departments[0].id;
      const fallbackJobTitleId = jobTitles[0].id;
      const fallbackLocationId = locations[0].id;
      const existingEmails = new Set(existingEmployees.map((item) => item.email.toLowerCase()));
      const managerByEmail = new Map(existingEmployees.map((item) => [item.email.toLowerCase(), item.id]));

      const validationErrors: Array<{ row: number; field: string; message: string }> = [];
      const validEmploymentTypes = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
      const validGenders = new Set(['MALE', 'FEMALE', 'OTHER']);
      const validFrequencies = new Set(['MONTHLY', 'BIWEEKLY', 'WEEKLY']);

      rows.forEach((row, index) => {
        const rowNum = index + 2;
        const requiredFields = ['first_name', 'last_name', 'email', 'hire_date'];

        for (const field of requiredFields) {
          if (!row[field]?.trim()) {
            validationErrors.push({ row: rowNum, field, message: 'Required' });
          }
        }

        const email = row.email?.trim().toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          validationErrors.push({ row: rowNum, field: 'email', message: 'Invalid email format' });
        }
        if (email && existingEmails.has(email)) {
          validationErrors.push({ row: rowNum, field: 'email', message: 'Email already exists in the system' });
        }

        const department = row.department?.trim().toLowerCase();
        if (department && !departmentMap.has(department)) {
          validationErrors.push({ row: rowNum, field: 'department', message: `Department "${row.department}" not found` });
        }

        const jobTitle = row.job_title?.trim().toLowerCase();
        if (jobTitle && !jobTitleMap.has(jobTitle)) {
          validationErrors.push({ row: rowNum, field: 'job_title', message: `Job title "${row.job_title}" not found` });
        }

        const location = row.location?.trim().toLowerCase();
        if (location && !locationMap.has(location)) {
          validationErrors.push({ row: rowNum, field: 'location', message: `Location "${row.location}" not found` });
        }

        const managerEmail = row.manager_email?.trim().toLowerCase();
        if (managerEmail && !managerByEmail.has(managerEmail)) {
          validationErrors.push({ row: rowNum, field: 'manager_email', message: `Manager email "${row.manager_email}" not found` });
        }

        if (row.employment_type && !validEmploymentTypes.has(row.employment_type.toUpperCase())) {
          validationErrors.push({
            row: rowNum,
            field: 'employment_type',
            message: 'Must be one of: FULL_TIME, PART_TIME, CONTRACT, INTERN',
          });
        }
        if (row.gender && !validGenders.has(row.gender.toUpperCase())) {
          validationErrors.push({ row: rowNum, field: 'gender', message: 'Must be one of: MALE, FEMALE, OTHER' });
        }
        if (row.salary_frequency && !validFrequencies.has(row.salary_frequency.toUpperCase())) {
          validationErrors.push({ row: rowNum, field: 'salary_frequency', message: 'Must be one of: MONTHLY, BIWEEKLY, WEEKLY' });
        }
      });

      if (validationErrors.length > 0) {
        return c.json(
          {
            success: false,
            error: 'Validation failed',
            errors: validationErrors,
            total_rows: rows.length,
            error_count: validationErrors.length,
          },
          422
        );
      }

      const results = { created: 0, skipped: 0, errors: [] as string[] };

      for (const row of rows) {
        try {
          const count = await prisma.employee.count({ where: { tenantId } });
          const employeeId = row.employee_id?.trim() || `LMN-${String(count + results.created + 1).padStart(4, '0')}`;
          const email = row.email.trim().toLowerCase();

          const employee = await prisma.employee.create({
            data: {
              tenantId,
              employeeId,
              firstName: row.first_name.trim(),
              middleName: row.middle_name?.trim() || null,
              lastName: row.last_name.trim(),
              email,
              personalEmail: row.personal_email?.trim() || null,
              phone: row.phone?.trim() || null,
              dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
              gender: row.gender?.toUpperCase() || null,
              maritalStatus: row.marital_status?.toUpperCase() || null,
              nationality: row.nationality?.trim() || null,
              nationalId: row.national_id?.trim() || null,
              hireDate: new Date(row.hire_date),
              employmentType: (row.employment_type || 'FULL_TIME').toUpperCase(),
              employmentStatus: 'ACTIVE',
              jobTitleId: row.job_title ? jobTitleMap.get(row.job_title.toLowerCase()) || fallbackJobTitleId : fallbackJobTitleId,
              departmentId: row.department ? departmentMap.get(row.department.toLowerCase()) || fallbackDepartmentId : fallbackDepartmentId,
              locationId: row.location ? locationMap.get(row.location.toLowerCase()) || fallbackLocationId : fallbackLocationId,
              managerId: row.manager_email ? managerByEmail.get(row.manager_email.toLowerCase()) || null : null,
              salary: Number(row.salary || 0),
              currency: row.currency || 'NGN',
              salaryFrequency: row.salary_frequency?.toUpperCase() || 'MONTHLY',
            },
          });

          if (row.address_street || row.address_city) {
            await prisma.address.create({
              data: {
                employeeId: employee.id,
                type: 'RESIDENTIAL',
                streetAddress: row.address_street || '',
                city: row.address_city || '',
                state: row.address_state || null,
                country: row.address_country || 'Nigeria',
                isPrimary: true,
              },
            });
          }

          if (row.emergency_contact_name) {
            await prisma.emergencyContact.create({
              data: {
                employeeId: employee.id,
                name: row.emergency_contact_name,
                phone: row.emergency_contact_phone || '',
                relationship: row.emergency_contact_relationship || 'CONTACT',
                isPrimary: true,
              },
            });
          }

          const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId } });
          if (leaveTypes.length > 0) {
            await prisma.leaveBalance.createMany({
              data: leaveTypes.map((leaveType) => ({
                tenantId,
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                year: new Date().getFullYear(),
                available: 0,
                taken: 0,
                carried: 0,
              })),
            });
          }

          existingEmails.add(email);
          managerByEmail.set(email, employee.id);
          results.created += 1;
        } catch (error) {
          results.errors.push(`Row for ${row.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'CREATE',
          resource: 'employees_bulk_import',
          resourceId: tenantId,
          changes: { total: rows.length, created: results.created, errors: results.errors.length },
        },
      });

      return c.json({ success: true, ...results });
    } catch (error) {
      console.error('Employee import error:', error);
      return c.json(
        { success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to import employees' } },
        500
      );
    }
  });

  // ========================================================================
  // GET /api/v1/employees/exited - List exited employees
  // ========================================================================
  app.get('/exited', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN', 'HEAD_OF_HR']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const q = (c.req.query('q') || '').trim();
      const exitType = c.req.query('exitType');
      const year = c.req.query('year');

      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          employmentStatus: 'EXITED',
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                  { employeeId: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          terminationDate: true,
        },
        orderBy: { terminationDate: 'desc' },
      });

      const exitRows = await prisma.$queryRawUnsafe<
        Array<{
          employeeId: string;
          exitType: string;
          exitStatus: string;
          lastWorkingDay: Date;
          isEligibleRehire: boolean;
        }>
      >(
        `SELECT DISTINCT ON ("employeeId")
            "employeeId", "exitType", "exitStatus", "lastWorkingDay", "isEligibleRehire"
         FROM "EmployeeExit"
         WHERE "tenantId" = $1
         ORDER BY "employeeId", "createdAt" DESC`,
        tenantId
      );

      const exitByEmployeeId = new Map(exitRows.map((row) => [row.employeeId, row]));

      const filtered = employees
        .map((employee) => {
          const exit = exitByEmployeeId.get(employee.id);
          return {
            id: employee.id,
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            terminationDate: employee.terminationDate,
            exitType: exit?.exitType || null,
            exitStatus: exit?.exitStatus || null,
            lastWorkingDay: exit?.lastWorkingDay || employee.terminationDate,
            isEligibleRehire: exit?.isEligibleRehire ?? true,
          };
        })
        .filter((row) => {
          const byType = exitType ? row.exitType === exitType : true;
          const byYear = year
            ? String((row.lastWorkingDay ? new Date(row.lastWorkingDay).getUTCFullYear() : '')) === year
            : true;
          return byType && byYear;
        });

      return c.json({ success: true, data: filtered, total: filtered.length });
    } catch (error) {
      console.error('Error fetching exited employees:', error);
      return c.json({ success: false, error: 'Failed to fetch exited employees' }, 500);
    }
  });

  // ========================================================================
  // POST /api/v1/employees/:id/exit - Initiate employee exit workflow
  // ========================================================================
  app.post('/:id/exit', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN', 'HEAD_OF_HR']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const employeeId = c.req.param('id');
      const payload = ExitEmployeeSchema.parse(await c.req.json());

      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        include: {
          jobTitle: { select: { title: true } },
          department: { select: { name: true } },
        },
      });

      if (!employee) {
        return c.json({ success: false, error: 'Employee not found' }, 404);
      }

      const noticeDate = new Date(payload.noticeDate);
      const lastWorkingDay = new Date(payload.lastWorkingDay);
      if (lastWorkingDay < noticeDate) {
        return c.json({ success: false, error: 'lastWorkingDay cannot be before noticeDate' }, 400);
      }

      const exitRecordRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO "EmployeeExit" (
            "id", "tenantId", "employeeId", "exitType", "exitStatus", "noticeDate", "lastWorkingDay",
            "exitReason", "exitInterviewNotes", "isEligibleRehire", "rehireNotes", "processedByUserId", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4, 'NOTICE_PERIOD', $5::date, $6::date,
            $7, $8, $9, $10, $11, now(), now()
          ) RETURNING id`,
        randomUUID(),
        tenantId,
        employee.id,
        payload.exitType,
        payload.noticeDate,
        payload.lastWorkingDay,
        payload.exitReason || null,
        payload.exitInterviewNotes || null,
        payload.isEligibleRehire ?? true,
        payload.rehireNotes || null,
        userId
      );

      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: 'NOTICE_PERIOD',
          terminationDate: new Date(payload.lastWorkingDay),
        },
      });

      await prisma.leaveRequest.updateMany({
        where: {
          employeeId: employee.id,
          status: { in: ['SUBMITTED', 'PENDING'] },
          startDate: { gt: new Date() },
        },
        data: {
          status: 'CANCELLED',
          reason: 'Cancelled due to employee exit',
        },
      });

      for (const task of OFFBOARDING_TASKS) {
        const due = new Date(lastWorkingDay);
        due.setUTCDate(due.getUTCDate() + task.dueDays);

        await prisma.$executeRawUnsafe(
          `INSERT INTO "OffboardingTask" (
             "id", "tenantId", "employeeId", "exitRecordId", "assigneeRole", "title", "dueDate", "status", "createdAt", "updatedAt"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'PENDING', now(), now())`,
          randomUUID(),
          tenantId,
          employee.id,
          exitRecordRows[0]?.id || null,
          task.assigneeRole,
          task.title,
          due.toISOString().slice(0, 10)
        );
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "EmploymentHistory"
            SET "exitDate" = $1::date,
                "exitType" = $2,
                "finalSalary" = $3,
                "notes" = COALESCE("notes", '') || $4
          WHERE "employeeId" = $5
            AND "exitDate" IS NULL`,
        payload.lastWorkingDay,
        payload.exitType,
        Number(employee.salary),
        `\nExited on ${payload.lastWorkingDay}`,
        employee.id
      );

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'UPDATE',
          resource: 'employee_exit',
          resourceId: employee.id,
          changes: {
            event: 'EMPLOYEE_EXIT_INITIATED',
            payload,
          },
        },
      });

      return c.json({ success: true, exitRecordId: exitRecordRows[0]?.id || null });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: 'Invalid request', details: error.errors }, 400);
      }
      console.error('Error initiating employee exit:', error);
      return c.json({ success: false, error: 'Failed to initiate employee exit' }, 500);
    }
  });

  // ========================================================================
  // POST /api/v1/employees/:id/rehire - Rehire exited employee
  // ========================================================================
  app.post('/:id/rehire', async (c) => {
    const denied = requireAnyRole(c, ['HR_ADMIN', 'SUPER_ADMIN', 'HEAD_OF_HR']);
    if (denied) return denied;

    try {
      const tenantId = c.get('tenantId');
      const userId = c.get('userId');
      const employeePk = c.req.param('id');
      const payload = RehireEmployeeSchema.parse(await c.req.json());

      const employee = await prisma.employee.findFirst({ where: { id: employeePk, tenantId } });
      if (!employee) {
        return c.json({ success: false, error: 'Employee not found' }, 404);
      }

      const [latestExit] = await prisma.$queryRawUnsafe<
        Array<{ id: string; isEligibleRehire: boolean; rehireNotes: string | null }>
      >(
        `SELECT id, "isEligibleRehire", "rehireNotes"
           FROM "EmployeeExit"
          WHERE "employeeId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 1`,
        employee.id
      );

      if (!latestExit?.isEligibleRehire) {
        return c.json(
          {
            success: false,
            error: 'This employee is not marked as eligible for rehire',
            notes: latestExit?.rehireNotes || null,
          },
          403
        );
      }

      const tenantEmployeeCount = await prisma.employee.count({ where: { tenantId } });
      const newEmployeeCode = `LMN-${String(tenantEmployeeCount + 1).padStart(4, '0')}`;

      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: 'ACTIVE',
          hireDate: new Date(payload.newHireDate),
          terminationDate: null,
          jobTitleId: payload.newJobTitle,
          departmentId: payload.newDepartment,
          salary: payload.newSalary,
          managerId: payload.newManagerId || null,
          employeeId: newEmployeeCode,
        },
      });

      if (latestExit?.id) {
        await prisma.$executeRawUnsafe(
          `UPDATE "EmployeeExit"
              SET "exitStatus" = 'REHIRED', "updatedAt" = now()
            WHERE id = $1`,
          latestExit.id
        );
      }

      const [latestStint] = await prisma.$queryRawUnsafe<Array<{ stintNumber: number }>>(
        `SELECT COALESCE(MAX("stintNumber"), 0) AS "stintNumber"
           FROM "EmploymentHistory"
          WHERE "employeeId" = $1`,
        employee.id
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO "EmploymentHistory" (
            "id", "tenantId", "employeeId", "stintNumber", "hireDate", "jobTitle", "department", "finalSalary", "notes", "createdAt"
          ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, now())`,
        randomUUID(),
        tenantId,
        employee.id,
        (latestStint?.stintNumber || 0) + 1,
        payload.newHireDate,
        payload.newJobTitle,
        payload.newDepartment,
        payload.newSalary,
        `Rehired: ${payload.rehireReason}`
      );

      await prisma.leaveBalance.deleteMany({ where: { employeeId: employee.id } });

      const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId }, select: { id: true, code: true } });
      const year = new Date(payload.newHireDate).getUTCFullYear();

      for (const leaveType of leaveTypes) {
        const code = leaveType.code.toUpperCase();
        const defaultAllocation = code.includes('ANNUAL') ? 24 : code.includes('SICK') ? 12 : 0;

        await prisma.leaveBalance.create({
          data: {
            tenantId,
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year,
            available: defaultAllocation,
            taken: 0,
            carried: 0,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'UPDATE',
          resource: 'employee_rehire',
          resourceId: employee.id,
          changes: {
            event: 'EMPLOYEE_REHIRED',
            payload,
            newEmployeeCode,
          },
        },
      });

      return c.json({ success: true, newEmployeeId: newEmployeeCode });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return c.json({ success: false, error: 'Invalid request', details: error.errors }, 400);
      }
      console.error('Error rehiring employee:', error);
      return c.json({ success: false, error: 'Failed to rehire employee' }, 500);
    }
  });

  // ========================================================================
  // GET /api/v1/employees/:id - Get single employee
  // ========================================================================
  app.get('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          jobTitle: true,
          department: true,
          location: true,
          manager: { select: { id: true, firstName: true, lastName: true } },
          directReports: { select: { id: true, firstName: true, lastName: true } },
          leaveBalances: { include: { leaveType: true } },
          documents: true,
          educations: true,
          workExperiences: true,
        },
      });

      if (!employee || employee.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      const [latestExit] = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT *
           FROM "EmployeeExit"
          WHERE "employeeId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 1`,
        employee.id
      );

      const history = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT *
           FROM "EmploymentHistory"
          WHERE "employeeId" = $1
          ORDER BY "stintNumber" ASC`,
        employee.id
      );

      const offboardingTasks = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT *
           FROM "OffboardingTask"
          WHERE "employeeId" = $1
          ORDER BY "dueDate" ASC`,
        employee.id
      );

      return c.json({
        success: true,
        data: {
          ...employee,
          latestExit: latestExit || null,
          employmentHistory: history,
          offboardingTasks,
        },
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      return c.json(
        { success: false, error: 'Failed to fetch employee' },
        500
      );
    }
  });

  // ========================================================================
  // PATCH /api/v1/employees/:id - Update employee
  // ========================================================================
  app.patch('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');
      const body = await c.req.json();

      // Validate input
      const validData = EmployeeUpdateSchema.parse(body);

      // Check ownership
      const existing = await prisma.employee.findUnique({
        where: { id },
      });

      if (!existing || existing.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      // Update employee
      const employee = await prisma.employee.update({
        where: { id },
        data: validData,
      });

      return c.json({
        success: true,
        data: employee,
        message: 'Employee updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating employee:', error);

      if (error.name === 'ZodError') {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: error.errors,
            },
          },
          400
        );
      }

      return c.json(
        { success: false, error: 'Failed to update employee' },
        500
      );
    }
  });

  // ========================================================================
  // DELETE /api/v1/employees/:id - Soft delete employee
  // ========================================================================
  app.delete('/:id', async (c) => {
    try {
      const tenantId = c.get('tenantId');
      const id = c.req.param('id');

      // Check ownership
      const existing = await prisma.employee.findUnique({
        where: { id },
      });

      if (!existing || existing.tenantId !== tenantId) {
        return c.json(
          { success: false, error: 'Employee not found' },
          404
        );
      }

      // Update to terminated status
      await prisma.employee.update({
        where: { id },
        data: {
          employmentStatus: 'TERMINATED',
          terminationDate: new Date(),
        },
      });

      return c.json({
        success: true,
        message: 'Employee terminated successfully',
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      return c.json(
        { success: false, error: 'Failed to delete employee' },
        500
      );
    }
  });

  return app;
}
