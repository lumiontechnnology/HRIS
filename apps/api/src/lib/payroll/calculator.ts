import { getAttendanceSummary, type AttendanceSummary } from './attendance-feed.js';
import {
  calculateOvertimePay,
  getBasicSalary,
  getEmployeeComponents,
  getRunComponents,
  type EmployeeComponentAssignment,
} from './components.js';
import { calculateNigeriaPAYE } from './calc.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampToNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

export interface PayrollEarningLine {
  componentId: string;
  code: string;
  name: string;
  amount: number;
  is_taxable: boolean;
  is_pensionable: boolean;
  is_nhf: boolean;
  display_on_payslip?: boolean;
}

export interface PayrollCalculation {
  employeeId: string;
  payrollRunId: string;
  periodStart: string;
  periodEnd: string;
  earnings: PayrollEarningLine[];
  grossPay: number;
  taxableIncome: number;
  pensionBase: number;
  nhfBase: number;
  monthlyPAYE: number;
  employeePension: number;
  employerPension: number;
  nhf: number;
  nsitf: number;
  totalEmployeeDeductions: number;
  netPay: number;
  attendanceSummary: AttendanceSummary;
  meta: {
    daysAbsent: number;
    overtimeHours: number;
  };
}

function resolvePercentageBase(
  component: EmployeeComponentAssignment['component'],
  components: EmployeeComponentAssignment[],
  currentEarnings: PayrollEarningLine[]
): number {
  if (component.percentage_base === 'BASIC') {
    return getBasicSalary(components);
  }

  if (component.percentage_base === 'GROSS') {
    return currentEarnings.reduce((sum, line) => sum + line.amount, 0);
  }

  return 0;
}

export async function calculateEmployeePayroll(
  employeeId: string,
  payrollRunId: string,
  periodStart: string,
  periodEnd: string,
  tenantId: string
): Promise<PayrollCalculation> {
  const asOfDate = periodStart.slice(0, 10);

  const components = await getEmployeeComponents(employeeId, asOfDate, tenantId);
  const runComponents = await getRunComponents(payrollRunId, employeeId);
  const attendance = await getAttendanceSummary(employeeId, periodStart, periodEnd, tenantId);

  const earnings: PayrollEarningLine[] = [];

  for (const { component, amount } of components) {
    let lineAmount = Number(amount || 0);

    if (component.frequency === 'PERCENTAGE') {
      const base = resolvePercentageBase(component, components, earnings);
      const percentage = Number(component.percentage_value || 0) / 100;
      lineAmount = base * percentage;
    }

    if (component.frequency === 'VARIABLE') {
      const runAmount = runComponents.find((item) => item.component_id === component.id)?.amount;
      lineAmount = Number(runAmount || 0);
    }

    if (component.frequency === 'FIXED' && attendance.totalWorkingDays > 0) {
      const dailyRate = lineAmount / attendance.totalWorkingDays;
      lineAmount -= dailyRate * attendance.daysAbsent;
      lineAmount -= (dailyRate / 2) * attendance.daysHalfDay;
    }

    earnings.push({
      componentId: component.id,
      code: component.code,
      name: component.name,
      amount: roundMoney(clampToNonNegative(lineAmount)),
      is_taxable: component.is_taxable,
      is_pensionable: component.is_pensionable,
      is_nhf: component.is_nhf_applicable,
      display_on_payslip: component.display_on_payslip,
    });
  }

  const overtimeAssigned = earnings.some((item) => item.code === 'OVERTIME');
  const overtimePay = calculateOvertimePay(
    getBasicSalary(components),
    Math.max(attendance.totalWorkingDays, 1),
    attendance.totalOvertimeHrs
  );

  if (overtimePay > 0 && !overtimeAssigned) {
    earnings.push({
      componentId: 'OVERTIME_AUTO',
      code: 'OVERTIME',
      name: 'Overtime Pay',
      amount: roundMoney(overtimePay),
      is_taxable: true,
      is_pensionable: true,
      is_nhf: false,
      display_on_payslip: true,
    });
  }

  const grossPay = roundMoney(earnings.reduce((sum, line) => sum + line.amount, 0));
  const taxableIncome = roundMoney(earnings.filter((line) => line.is_taxable).reduce((sum, line) => sum + line.amount, 0));
  const pensionBase = roundMoney(earnings.filter((line) => line.is_pensionable).reduce((sum, line) => sum + line.amount, 0));
  const nhfBase = roundMoney(earnings.filter((line) => line.is_nhf).reduce((sum, line) => sum + line.amount, 0));

  const annualTaxable = taxableIncome * 12;
  const monthlyPAYE = roundMoney(calculateNigeriaPAYE(annualTaxable));

  const employeePension = roundMoney(pensionBase * 0.08);
  const employerPension = roundMoney(pensionBase * 0.1);
  const nhf = roundMoney(nhfBase * 0.025);
  const nsitf = roundMoney(grossPay * 0.01);

  const totalEmployeeDeductions = roundMoney(monthlyPAYE + employeePension + nhf);
  const netPay = roundMoney(grossPay - totalEmployeeDeductions);

  return {
    employeeId,
    payrollRunId,
    periodStart,
    periodEnd,
    earnings,
    grossPay,
    taxableIncome,
    pensionBase,
    nhfBase,
    monthlyPAYE,
    employeePension,
    employerPension,
    nhf,
    nsitf,
    totalEmployeeDeductions,
    netPay,
    attendanceSummary: attendance,
    meta: {
      daysAbsent: attendance.daysAbsent,
      overtimeHours: attendance.totalOvertimeHrs,
    },
  };
}
