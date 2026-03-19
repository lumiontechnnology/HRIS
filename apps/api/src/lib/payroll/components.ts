import { prisma } from '@lumion/database';

export type PayrollComponentFrequency = 'FIXED' | 'VARIABLE' | 'PERCENTAGE' | 'FORMULA';

export interface PayrollComponent {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  type: string;
  frequency: PayrollComponentFrequency;
  is_taxable: boolean;
  is_pensionable: boolean;
  is_nhf_applicable: boolean;
  percentage_base: string | null;
  percentage_value: number | null;
  display_on_payslip: boolean;
  sort_order: number;
  description: string | null;
  is_active: boolean;
}

interface EmployeeComponentRow {
  amount: unknown;
  payroll_component: PayrollComponent;
}

export interface EmployeeComponentAssignment {
  component: PayrollComponent;
  amount: number;
}

interface PayrollRunComponentRow {
  component_id: string;
  amount: unknown;
}

export async function getEmployeeComponents(
  employeeId: string,
  asOfDate: string,
  tenantId: string
): Promise<EmployeeComponentAssignment[]> {
  const rows = await prisma.$queryRawUnsafe<EmployeeComponentRow[]>(
    `SELECT
       ec.amount,
       json_build_object(
         'id', pc.id,
         'tenant_id', pc.tenant_id,
         'name', pc.name,
         'code', pc.code,
         'type', pc.type,
         'frequency', pc.frequency,
         'is_taxable', pc.is_taxable,
         'is_pensionable', pc.is_pensionable,
         'is_nhf_applicable', pc.is_nhf_applicable,
         'percentage_base', pc.percentage_base,
         'percentage_value', pc.percentage_value,
         'display_on_payslip', pc.display_on_payslip,
         'sort_order', pc.sort_order,
         'description', pc.description,
         'is_active', pc.is_active
       ) AS payroll_component
     FROM employee_components ec
     JOIN payroll_components pc ON pc.id = ec.component_id
    WHERE ec.employee_id = $1
      AND ec.tenant_id = $2
      AND ec.effective_from <= $3::date
      AND (ec.effective_to IS NULL OR ec.effective_to >= $3::date)
      AND pc.is_active = true
    ORDER BY pc.sort_order ASC, pc.name ASC`,
    employeeId,
    tenantId,
    asOfDate
  );

  return rows.map((row) => ({
    component: row.payroll_component,
    amount: Number(row.amount || 0),
  }));
}

export async function getRunComponents(payrollRunId: string, employeeId: string): Promise<PayrollRunComponentRow[]> {
  const rows = await prisma.$queryRawUnsafe<PayrollRunComponentRow[]>(
    `SELECT component_id, amount
       FROM payroll_run_components
      WHERE payroll_run_id = $1
        AND employee_id = $2`,
    payrollRunId,
    employeeId
  );

  return rows.map((row) => ({
    component_id: row.component_id,
    amount: Number(row.amount || 0),
  }));
}

export function getBasicSalary(components: EmployeeComponentAssignment[]): number {
  return components.find((entry) => entry.component.code === 'BASIC')?.amount || 0;
}

export function calculateOvertimePay(basicSalary: number, workingDays: number, overtimeHours: number): number {
  if (overtimeHours <= 0 || workingDays <= 0 || basicSalary <= 0) {
    return 0;
  }

  const hourlyRate = basicSalary / (workingDays * 8);
  return hourlyRate * overtimeHours * 1.5;
}
