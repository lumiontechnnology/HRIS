import { prisma } from '@lumion/database';
import { computeNigeriaMonthlyPayroll } from './calc.js';
import { countWorkingDays, type AttendanceSummary } from './attendance-feed.js';

export interface ProratedPayrollResult {
  grossPay: number;
  netPay: number;
  deductions: number;
  payeTax: number;
  pension: number;
  nhf: number;
  workedDays: number;
  totalWorkingDays: number;
  proratedSalary: number;
  unusedLeaveDays: number;
  unusedLeavePayout: number;
  gratuity: number;
  loanDeduction: number;
  finalSettlement: {
    proratedSalary: number;
    unusedLeavePayout: number;
    gratuity: number;
    loanDeduction: number;
    grossSettlement: number;
    taxOnSettlement: number;
    netSettlement: number;
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function yearsBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(0, diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function calculateGratuity(monthlySalary: number, tenureYears: number): number {
  const dailyRate = (monthlySalary * 12) / 365;
  if (tenureYears < 5) return 0;
  if (tenureYears < 10) return dailyRate * 15 * tenureYears;
  if (tenureYears < 15) return dailyRate * 20 * tenureYears;
  return dailyRate * 25 * tenureYears;
}

async function getUnusedAnnualLeaveDays(employeeId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ available: unknown }>>(
    `SELECT lb.available
       FROM "LeaveBalance" lb
       JOIN "LeaveType" lt ON lt.id = lb."leaveTypeId"
      WHERE lb."employeeId" = $1
        AND UPPER(lt.code) LIKE '%ANNUAL%'
      ORDER BY lb.year DESC
      LIMIT 1`,
    employeeId
  );

  return Number(rows[0]?.available || 0);
}

async function getOutstandingLoanBalance(employeeId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ amount: unknown }>>(
    `SELECT 0::numeric AS amount
      WHERE EXISTS (SELECT 1 FROM "Employee" WHERE id = $1)`,
    employeeId
  );

  return Number(rows[0]?.amount || 0);
}

export async function calculateProratedPayroll(input: {
  employeeId: string;
  tenantId: string;
  salary: number;
  basicSalary: number;
  hireDate: Date;
  terminationDate: Date;
  periodStart: string;
  periodEnd: string;
  attendance: AttendanceSummary;
}): Promise<ProratedPayrollResult> {
  const totalWorkingDays = await countWorkingDays(input.periodStart, input.periodEnd, input.tenantId);
  const workedDays = await countWorkingDays(input.periodStart, input.terminationDate.toISOString(), input.tenantId);

  const safeTotalDays = Math.max(totalWorkingDays, 1);
  const dailyRate = input.salary / safeTotalDays;

  let proratedSalary = dailyRate * workedDays;
  proratedSalary -= dailyRate * input.attendance.daysAbsent;

  const hourlyRate = dailyRate / 8;
  const overtimePay = hourlyRate * input.attendance.totalOvertimeHrs * 1.5;
  proratedSalary += overtimePay;

  const unusedLeaveDays = await getUnusedAnnualLeaveDays(input.employeeId);
  const unusedLeavePayout = dailyRate * unusedLeaveDays;

  const tenureYears = yearsBetween(input.hireDate, input.terminationDate);
  const gratuity = calculateGratuity(input.salary, tenureYears);
  const loanDeduction = await getOutstandingLoanBalance(input.employeeId);

  const grossSettlement = proratedSalary + unusedLeavePayout + gratuity;
  const taxBreakdown = computeNigeriaMonthlyPayroll(grossSettlement);

  const pension = proratedSalary * 0.08;
  const nhfBase = input.basicSalary * (workedDays / safeTotalDays);
  const nhf = nhfBase * 0.025;

  const totalDeductions = taxBreakdown.payeTax + pension + nhf + loanDeduction;
  const netSettlement = grossSettlement - totalDeductions;

  return {
    grossPay: roundMoney(grossSettlement),
    netPay: roundMoney(netSettlement),
    deductions: roundMoney(totalDeductions),
    payeTax: roundMoney(taxBreakdown.payeTax),
    pension: roundMoney(pension),
    nhf: roundMoney(nhf),
    workedDays,
    totalWorkingDays,
    proratedSalary: roundMoney(proratedSalary),
    unusedLeaveDays: roundMoney(unusedLeaveDays),
    unusedLeavePayout: roundMoney(unusedLeavePayout),
    gratuity: roundMoney(gratuity),
    loanDeduction: roundMoney(loanDeduction),
    finalSettlement: {
      proratedSalary: roundMoney(proratedSalary),
      unusedLeavePayout: roundMoney(unusedLeavePayout),
      gratuity: roundMoney(gratuity),
      loanDeduction: roundMoney(loanDeduction),
      grossSettlement: roundMoney(grossSettlement),
      taxOnSettlement: roundMoney(taxBreakdown.payeTax),
      netSettlement: roundMoney(netSettlement),
    },
  };
}
