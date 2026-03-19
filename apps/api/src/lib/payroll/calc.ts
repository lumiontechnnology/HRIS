const MONTHS_IN_YEAR = 12;

interface Bracket {
  annualLimit: number;
  rate: number;
}

const NIGERIA_PAYE_BRACKETS: Bracket[] = [
  { annualLimit: 300000, rate: 0.07 },
  { annualLimit: 300000, rate: 0.11 },
  { annualLimit: 500000, rate: 0.15 },
  { annualLimit: 500000, rate: 0.19 },
  { annualLimit: 1600000, rate: 0.21 },
];

const TOP_RATE = 0.24;
const PENSION_RATE = 0.08;
const NHF_RATE = 0.025;

function clampToNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function annualConsolidatedRelief(grossAnnualIncome: number): number {
  return 200000 + grossAnnualIncome * 0.2;
}

function annualTaxableIncome(grossAnnualIncome: number): number {
  const taxable = grossAnnualIncome - annualConsolidatedRelief(grossAnnualIncome);
  return clampToNonNegative(taxable);
}

function annualPaye(taxableAnnualIncome: number): number {
  let remaining = taxableAnnualIncome;
  let tax = 0;

  for (const bracket of NIGERIA_PAYE_BRACKETS) {
    if (remaining <= 0) {
      break;
    }

    const taxableInBracket = Math.min(remaining, bracket.annualLimit);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }

  if (remaining > 0) {
    tax += remaining * TOP_RATE;
  }

  return clampToNonNegative(tax);
}

export function calculateNigeriaPAYE(annualTaxableIncome: number): number {
  const annualTax = annualPaye(clampToNonNegative(annualTaxableIncome));
  return roundMoney(annualTax / MONTHS_IN_YEAR);
}

export interface PayrollComputation {
  grossPay: number;
  payeTax: number;
  pension: number;
  nhf: number;
  totalDeductions: number;
  netPay: number;
}

export function computeNigeriaMonthlyPayroll(grossMonthlyPay: number): PayrollComputation {
  const grossPay = clampToNonNegative(grossMonthlyPay);
  const annualGross = grossPay * MONTHS_IN_YEAR;
  const taxableAnnual = annualTaxableIncome(annualGross);

  const payeTax = calculateNigeriaPAYE(taxableAnnual);
  const pension = grossPay * PENSION_RATE;
  const nhf = grossPay * NHF_RATE;
  const totalDeductions = payeTax + pension + nhf;
  const netPay = grossPay - totalDeductions;

  return {
    grossPay: roundMoney(grossPay),
    payeTax: roundMoney(payeTax),
    pension: roundMoney(pension),
    nhf: roundMoney(nhf),
    totalDeductions: roundMoney(totalDeductions),
    netPay: roundMoney(netPay),
  };
}
