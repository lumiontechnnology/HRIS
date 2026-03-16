// ============================================================================
// CORE DOMAIN TYPES
// ============================================================================

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HR_ADMIN = 'HR_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  PAYROLL_ADMIN = 'PAYROLL_ADMIN',
  RECRUITER = 'RECRUITER',
  AUDITOR = 'AUDITOR',
}

export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
  RESIGNED = 'RESIGNED',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  TEMPORARY = 'TEMPORARY',
  PROBATION = 'PROBATION',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
}

export enum SalaryFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  SEMI_MONTHLY = 'SEMI_MONTHLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

export enum LeaveStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  MANAGER_APPROVED = 'MANAGER_APPROVED',
  HR_APPROVED = 'HR_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  DISBURSED = 'DISBURSED',
  LOCKED = 'LOCKED',
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  PHONE_INTERVIEW = 'PHONE_INTERVIEW',
  TECHNICAL_TEST = 'TECHNICAL_TEST',
  PANEL_INTERVIEW = 'PANEL_INTERVIEW',
  OFFER = 'OFFER',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
}

export enum ReviewCycleType {
  ANNUAL = 'ANNUAL',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  QUARTERLY = 'QUARTERLY',
  PROBATION = 'PROBATION',
}

export enum ReviewStatus {
  GOALS_SET = 'GOALS_SET',
  SELF_APPRAISAL = 'SELF_APPRAISAL',
  MANAGER_REVIEW = 'MANAGER_REVIEW',
  CALIBRATION = 'CALIBRATION',
  MODERATION = 'MODERATION',
  FINALIZED = 'FINALIZED',
  SHARED_WITH_EMPLOYEE = 'SHARED_WITH_EMPLOYEE',
}

export enum AssetStatus {
  NEW = 'NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
}

export enum NotificationType {
  LEAVE_REQUEST = 'LEAVE_REQUEST',
  PAYROLL = 'PAYROLL',
  ATTENDANCE = 'ATTENDANCE',
  BIRTHDAY = 'BIRTHDAY',
  ANNIVERSARY = 'ANNIVERSARY',
  DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  SYSTEM = 'SYSTEM',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ApiMeta {
  page?: number;
  total?: number;
  limit?: number;
  hasMore?: boolean;
  cursor?: string;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: Role[];
  permissions: string[];
  mfaEnabled: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: AuthUser;
  expiresAt: number;
  iat: number;
}

// ============================================================================
// EMPLOYEE TYPES
// ============================================================================

export interface Employee {
  id: string;
  tenantId: string;
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  alternatePhone?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  nationalId?: string;
  passportNumber?: string;
  taxId?: string;
  socialSecurityNo?: string;
  bloodGroup?: string;
  hireDate: Date;
  confirmationDate?: Date;
  probationEndDate?: Date;
  terminationDate?: Date;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  jobTitleId: string;
  departmentId: string;
  locationId: string;
  managerId?: string;
  salary: number;
  currency: string;
  salaryFrequency: SalaryFrequency;
  userId?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// LEAVE TYPES
// ============================================================================

export interface LeaveType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  requiresApproval: boolean;
  requiresDocumentation: boolean;
  isGenderRestricted: boolean;
  maxConsecutiveDays?: number;
  accrualRuleId?: string;
  carryoverLimit?: number;
  carryoverExpiry?: number; // days
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  available: number;
  taken: number;
  carried: number;
  updated: Date;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  duration: number; // days
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvalDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PAYROLL TYPES
// ============================================================================

export interface PayrollRun {
  id: string;
  tenantId: string;
  period: string; // YYYY-MM format
  payScheduleId: string;
  status: PayrollStatus;
  startDate: Date;
  endDate: Date;
  processedBy?: string;
  processedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payslip {
  id: string;
  tenantId: string;
  employeeId: string;
  payrollRunId: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  currency: string;
  pdfUrl?: string;
  signed: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page?: number;
    total?: number;
    limit?: number;
    hasMore?: boolean;
    cursor?: string;
  };
}
