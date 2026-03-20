import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';

const CSV_REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'work_email',
  'hire_date',
  'employment_type',
  'job_title',
  'department',
  'location',
] as const;

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').replace(/^"|"$/g, '').trim();
    });
    if (!row.work_email && row.email) row.work_email = row.email;
    return row;
  });
}

function leaveAllocationByCode(code: string): number {
  const n = code.toUpperCase();
  if (n.includes('ANNUAL')) return 24;
  if (n.includes('SICK')) return 12;
  return 0;
}

export async function POST(req: NextRequest) {
  const actor = await getAuthedUserWithTenant(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const tenantId = actor.tenantId;
    const userId = actor.id;

    const formData = await req.formData();
    const csvFile = formData.get('csv');
    if (!csvFile || !(csvFile instanceof File)) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_FILE', message: 'CSV file is required' } }, { status: 400 });
    }

    const rows = parseCsv(await csvFile.text());
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'EMPTY_FILE', message: 'No rows found in CSV' } }, { status: 400 });
    }

    const missingColumns = CSV_REQUIRED_FIELDS.filter((col) => !(col in rows[0]));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', errors: missingColumns.map((col) => ({ row: 1, field: col, message: 'Missing required column' })) },
        { status: 422 }
      );
    }

    const [departments, jobTitles, locations, existingEmployees] = await Promise.all([
      prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      prisma.jobTitle.findMany({ where: { tenantId }, select: { id: true, title: true } }),
      prisma.location.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      prisma.employee.findMany({ where: { tenantId }, select: { id: true, email: true } }),
    ]);

    if (departments.length === 0 || jobTitles.length === 0 || locations.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'REFERENCE_DATA_MISSING', message: 'Departments, job titles, and locations must exist before import' } },
        { status: 400 }
      );
    }

    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const jobTitleMap = new Map(jobTitles.map((j) => [j.title.toLowerCase(), j.id]));
    const locationMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));
    const fallbackDepartmentId = departments[0].id;
    const fallbackJobTitleId = jobTitles[0].id;
    const fallbackLocationId = locations[0].id;
    const existingEmails = new Set(existingEmployees.map((e) => e.email.toLowerCase()));
    const managerByEmail = new Map(existingEmployees.map((e) => [e.email.toLowerCase(), e.id]));
    const csvEmails = new Set<string>();

    const validEmploymentTypes = new Set(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
    const validGenders = new Set(['MALE', 'FEMALE', 'OTHER']);
    const validFrequencies = new Set(['MONTHLY', 'BIWEEKLY', 'WEEKLY']);
    const validationErrors: Array<{ row: number; field: string; message: string }> = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      for (const field of CSV_REQUIRED_FIELDS) {
        if (!row[field]?.trim()) {
          validationErrors.push({ row: rowNum, field, message: 'Required' });
        }
      }

      const email = row.work_email?.trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        validationErrors.push({ row: rowNum, field: 'work_email', message: 'Invalid email format' });
      }
      if (email && existingEmails.has(email)) {
        validationErrors.push({ row: rowNum, field: 'work_email', message: 'Email already exists in the system' });
      }
      if (email && csvEmails.has(email)) {
        validationErrors.push({ row: rowNum, field: 'work_email', message: 'Duplicate email in uploaded file' });
      }
      if (email) csvEmails.add(email);

      if (row.department && !departmentMap.has(row.department.trim().toLowerCase())) {
        validationErrors.push({ row: rowNum, field: 'department', message: `Department "${row.department}" not found` });
      }
      if (row.job_title && !jobTitleMap.has(row.job_title.trim().toLowerCase())) {
        validationErrors.push({ row: rowNum, field: 'job_title', message: `Job title "${row.job_title}" not found` });
      }
      if (row.location && !locationMap.has(row.location.trim().toLowerCase())) {
        validationErrors.push({ row: rowNum, field: 'location', message: `Location "${row.location}" not found` });
      }
      if (row.manager_email?.trim() && !managerByEmail.has(row.manager_email.trim().toLowerCase())) {
        validationErrors.push({ row: rowNum, field: 'manager_email', message: `Manager email "${row.manager_email}" not found` });
      }
      if (row.employment_type && !validEmploymentTypes.has(row.employment_type.toUpperCase())) {
        validationErrors.push({ row: rowNum, field: 'employment_type', message: 'Must be one of: FULL_TIME, PART_TIME, CONTRACT, INTERN' });
      }
      if (row.gender && !validGenders.has(row.gender.toUpperCase())) {
        validationErrors.push({ row: rowNum, field: 'gender', message: 'Must be one of: MALE, FEMALE, OTHER' });
      }
      if (row.salary_frequency && !validFrequencies.has(row.salary_frequency.toUpperCase())) {
        validationErrors.push({ row: rowNum, field: 'salary_frequency', message: 'Must be one of: MONTHLY, BIWEEKLY, WEEKLY' });
      }
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', errors: validationErrors, total_rows: rows.length, error_count: validationErrors.length },
        { status: 422 }
      );
    }

    const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId }, select: { id: true, code: true } });
    const baseCount = await prisma.employee.count({ where: { tenantId } });

    const created = await prisma.$transaction(async (tx) => {
      let createdCount = 0;

      for (const row of rows) {
        const employeeCode = `LMN-${String(baseCount + createdCount + 1).padStart(4, '0')}`;
        const email = row.work_email.trim().toLowerCase();

        const employee = await tx.employee.create({
          data: {
            tenantId,
            employeeId: employeeCode,
            firstName: row.first_name.trim(),
            lastName: row.last_name.trim(),
            email,
            personalEmail: row.personal_email?.trim() || null,
            phone: row.phone?.trim() || null,
            dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
            gender: row.gender?.toUpperCase() || null,
            hireDate: new Date(row.hire_date),
            employmentType: (row.employment_type || 'FULL_TIME').toUpperCase(),
            employmentStatus: 'ACTIVE',
            jobTitleId: row.job_title ? jobTitleMap.get(row.job_title.toLowerCase()) || fallbackJobTitleId : fallbackJobTitleId,
            departmentId: row.department ? departmentMap.get(row.department.toLowerCase()) || fallbackDepartmentId : fallbackDepartmentId,
            locationId: row.location ? locationMap.get(row.location.toLowerCase()) || fallbackLocationId : fallbackLocationId,
            managerId: row.manager_email ? managerByEmail.get(row.manager_email.toLowerCase()) || null : null,
            salary: Number(row.salary || 1),
            currency: row.currency || 'NGN',
            salaryFrequency: row.salary_frequency?.toUpperCase() || 'MONTHLY',
          },
        });

        if (row.address_street || row.address_city) {
          await tx.address.create({
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
          await tx.emergencyContact.create({
            data: {
              employeeId: employee.id,
              name: row.emergency_contact_name,
              phone: row.emergency_contact_phone || '',
              relationship: row.emergency_contact_relationship || 'CONTACT',
              isPrimary: true,
            },
          });
        }

        if (leaveTypes.length > 0) {
          await tx.leaveBalance.createMany({
            data: leaveTypes.map((lt) => ({
              tenantId,
              employeeId: employee.id,
              leaveTypeId: lt.id,
              year: new Date(row.hire_date).getUTCFullYear(),
              available: leaveAllocationByCode(lt.code),
              taken: 0,
              carried: 0,
            })),
          });
        }

        managerByEmail.set(email, employee.id);
        createdCount += 1;
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'BULK_IMPORT',
          resource: 'employees_bulk_import',
          resourceId: tenantId,
          changes: { action: 'BULK_IMPORT', details: { total: rows.length, created: createdCount } },
        },
      });

      return createdCount;
    });

    return NextResponse.json({ success: true, created, total: rows.length });
  } catch (error) {
    console.error('Employee import error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_ERROR', message: 'Failed to import employees' } },
      { status: 500 }
    );
  }
}
