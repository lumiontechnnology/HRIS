import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export const MFASetupSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const MFAVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const PasswordChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

// ============================================================================
// EMPLOYEE SCHEMAS
// ============================================================================

export const EmployeeCreateSchema = z.object({
  firstName: z.string().min(2, 'First name is required').max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(2, 'Last name is required').max(100),
  preferredName: z.string().max(100).optional(),
  email: z.string().email('Invalid email address'),
  personalEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number').optional(),
  alternatePhone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number').optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  passportNumber: z.string().optional(),
  taxId: z.string().optional(),
  socialSecurityNo: z.string().optional(),
  bloodGroup: z.string().optional(),
  hireDate: z.string().datetime('Invalid date format'),
  confirmationDate: z.string().datetime().optional(),
  probationEndDate: z.string().datetime().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'PROBATION']),
  employmentStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED']),
  jobTitleId: z.string().uuid('Invalid job title ID'),
  departmentId: z.string().uuid('Invalid department ID'),
  locationId: z.string().uuid('Invalid location ID'),
  managerId: z.string().uuid('Invalid manager ID').optional(),
  salary: z.number().positive('Salary must be positive'),
  currency: z.string().length(3, 'Currency code must be 3 characters').default('NGN'),
  salaryFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

export const EmployeeBulkImportSchema = z.array(EmployeeCreateSchema);

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// LEAVE SCHEMAS
// ============================================================================

export const LeaveRequestCreateSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  leaveTypeId: z.string().uuid('Invalid leave type ID'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  reason: z.string().max(1000).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

export const LeaveRequestApprovalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  approvalNotes: z.string().max(500).optional(),
});

// ============================================================================
// PAYROLL SCHEMAS
// ============================================================================

export const PayrollRunCreateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  payScheduleId: z.string().uuid('Invalid pay schedule ID'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
});

export const PayrollApprovalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  approvalNotes: z.string().max(1000).optional(),
});

// ============================================================================
// ORGANIZATION SCHEMAS
// ============================================================================

export const DepartmentCreateSchema = z.object({
  name: z.string().min(2, 'Department name is required').max(100),
  code: z.string().min(2, 'Department code is required').max(20),
  description: z.string().max(500).optional(),
  parentDepartmentId: z.string().uuid().optional(),
  headId: z.string().uuid('Invalid department head ID').optional(),
});

export const JobTitleCreateSchema = z.object({
  title: z.string().min(2, 'Job title is required').max(100),
  code: z.string().min(2, 'Job code is required').max(20),
  description: z.string().max(500).optional(),
  departmentId: z.string().uuid('Invalid department ID'),
  gradeId: z.string().uuid('Invalid grade ID').optional(),
});

export const LocationCreateSchema = z.object({
  name: z.string().min(2, 'Location name is required').max(100),
  code: z.string().min(2, 'Location code is required').max(20),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().default('UTC'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type EmployeeCreateInput = z.infer<typeof EmployeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateSchema>;
export type LeaveRequestCreateInput = z.infer<typeof LeaveRequestCreateSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
