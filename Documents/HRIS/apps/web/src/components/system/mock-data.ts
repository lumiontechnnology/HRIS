export interface EmployeeRow {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Probation';
  manager: string;
  location: 'Lagos' | 'Abuja' | 'Remote';
}

export const employeeRows: EmployeeRow[] = [
  {
    id: 'emp-001',
    name: 'John Okonkwo',
    employeeId: 'LMN-0001',
    department: 'Engineering',
    role: 'Chief Technology Officer',
    status: 'Active',
    manager: 'Executive Board',
    location: 'Lagos',
  },
  {
    id: 'emp-002',
    name: 'Chioma Adeyemi',
    employeeId: 'LMN-0002',
    department: 'Engineering',
    role: 'Senior Engineer',
    status: 'Active',
    manager: 'John Okonkwo',
    location: 'Lagos',
  },
  {
    id: 'emp-003',
    name: 'Tunde Okafor',
    employeeId: 'LMN-0003',
    department: 'Engineering',
    role: 'Senior Engineer',
    status: 'Active',
    manager: 'John Okonkwo',
    location: 'Remote',
  },
  {
    id: 'emp-004',
    name: 'Blessing Okafor',
    employeeId: 'LMN-0004',
    department: 'Human Resources',
    role: 'HR Manager',
    status: 'Active',
    manager: 'Executive Board',
    location: 'Lagos',
  },
  {
    id: 'emp-005',
    name: 'Amara Ngoako',
    employeeId: 'LMN-0005',
    department: 'Sales',
    role: 'Sales Manager',
    status: 'On Leave',
    manager: 'Executive Board',
    location: 'Abuja',
  },
  {
    id: 'emp-006',
    name: 'David Peter',
    employeeId: 'LMN-0006',
    department: 'Finance',
    role: 'Payroll Analyst',
    status: 'Probation',
    manager: 'Blessing Okafor',
    location: 'Lagos',
  },
];

export interface PayrollRow {
  id: string;
  employee: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  tax: number;
  netPay: number;
  state: 'Draft' | 'Processing' | 'Review' | 'Approved' | 'Disbursed';
}

export const payrollRows: PayrollRow[] = [
  {
    id: 'pay-001',
    employee: 'John Okonkwo',
    baseSalary: 5000000,
    allowances: 450000,
    deductions: 220000,
    tax: 375000,
    netPay: 4855000,
    state: 'Review',
  },
  {
    id: 'pay-002',
    employee: 'Chioma Adeyemi',
    baseSalary: 3000000,
    allowances: 240000,
    deductions: 90000,
    tax: 225000,
    netPay: 2925000,
    state: 'Review',
  },
  {
    id: 'pay-003',
    employee: 'Tunde Okafor',
    baseSalary: 2800000,
    allowances: 210000,
    deductions: 80000,
    tax: 210000,
    netPay: 2720000,
    state: 'Processing',
  },
];

export interface CandidateCard {
  id: string;
  name: string;
  tags: string[];
  score: number;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired';
}

export const candidates: CandidateCard[] = [
  {
    id: 'cand-001',
    name: 'Adaobi Nwankwo',
    tags: ['Frontend', 'React', 'Remote'],
    score: 84,
    stage: 'Applied',
  },
  {
    id: 'cand-002',
    name: 'Michael Chukwu',
    tags: ['Backend', 'Node.js', 'Lagos'],
    score: 79,
    stage: 'Screening',
  },
  {
    id: 'cand-003',
    name: 'Deborah Salami',
    tags: ['HRBP', 'Compliance'],
    score: 88,
    stage: 'Interview',
  },
  {
    id: 'cand-004',
    name: 'Samuel Akpan',
    tags: ['Finance', 'Payroll'],
    score: 82,
    stage: 'Offer',
  },
  {
    id: 'cand-005',
    name: 'Ruth Uche',
    tags: ['Data', 'Analytics'],
    score: 91,
    stage: 'Hired',
  },
];
