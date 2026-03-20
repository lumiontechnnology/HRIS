import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';

const CSV_COLUMNS = [
  'first_name',
  'last_name',
  'work_email',
  'personal_email',
  'phone',
  'date_of_birth',
  'gender',
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
];

const EXAMPLE_ROWS: Record<string, string>[] = [
  {
    first_name: 'Adaeze',
    last_name: 'Okafor',
    work_email: 'adaeze.okafor@lumionhris.com',
    personal_email: 'adaeze.okafor@gmail.com',
    phone: '+2348012345678',
    date_of_birth: '1993-04-09',
    gender: 'FEMALE',
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
  },
  {
    first_name: 'Chinonso',
    last_name: 'Eze',
    work_email: 'chinonso.eze@lumionhris.com',
    personal_email: '',
    phone: '',
    date_of_birth: '',
    gender: 'MALE',
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
  },
  {
    first_name: 'Bamidele',
    last_name: 'Akinola',
    work_email: 'bamidele.akinola@lumionhris.com',
    personal_email: '',
    phone: '+2348123456700',
    date_of_birth: '1996-11-21',
    gender: 'MALE',
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
  },
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: Record<string, string>[]): string {
  const header = CSV_COLUMNS.join(',');
  const body = rows
    .map((row) => CSV_COLUMNS.map((col) => escapeCsv(row[col] ?? '')).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
}

export async function GET(req: NextRequest) {
  const actor = await getAuthedUserWithTenant(req);
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'HR_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const csv = toCsv(EXAMPLE_ROWS);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lumion-employees-template.csv"',
    },
  });
}
