import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumion/database';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';

const CSV_COLUMNS = [
  'first_name', 'last_name', 'work_email', 'personal_email', 'phone',
  'date_of_birth', 'gender', 'hire_date', 'employment_type', 'job_title',
  'department', 'location', 'manager_email', 'salary', 'currency',
  'salary_frequency', 'address_street', 'address_city', 'address_state',
  'address_country', 'emergency_contact_name', 'emergency_contact_phone',
  'emergency_contact_relationship', 'bank_name', 'account_number', 'account_name',
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  const actor = await getAuthedUserWithTenant(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    where: { tenantId: actor.tenantId, employmentStatus: 'ACTIVE' },
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

  const rows = employees.map((emp) => ({
    first_name: emp.firstName,
    last_name: emp.lastName,
    work_email: emp.email,
    personal_email: emp.personalEmail || '',
    phone: emp.phone || '',
    date_of_birth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().slice(0, 10) : '',
    gender: emp.gender || '',
    hire_date: emp.hireDate.toISOString().slice(0, 10),
    employment_type: emp.employmentType,
    job_title: emp.jobTitle?.title || '',
    department: emp.department?.name || '',
    location: emp.location?.name || '',
    manager_email: emp.manager?.email || '',
    salary: String(emp.salary),
    currency: emp.currency,
    salary_frequency: emp.salaryFrequency,
    address_street: emp.addresses[0]?.streetAddress || '',
    address_city: emp.addresses[0]?.city || '',
    address_state: emp.addresses[0]?.state || '',
    address_country: emp.addresses[0]?.country || '',
    emergency_contact_name: emp.emergencyContacts[0]?.name || '',
    emergency_contact_phone: emp.emergencyContacts[0]?.phone || '',
    emergency_contact_relationship: emp.emergencyContacts[0]?.relationship || '',
    bank_name: '',
    account_number: '',
    account_name: '',
  }));

  const header = CSV_COLUMNS.join(',');
  const body = rows.map((row) => CSV_COLUMNS.map((col) => escapeCsv(row[col as keyof typeof row] ?? '')).join(',')).join('\n');
  const csv = `${header}\n${body}\n`;
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="lumion-employees-${date}.csv"`,
    },
  });
}
