-- Payroll component configuration and assignment foundations.

DO $$
BEGIN
  CREATE TYPE component_type AS ENUM (
    'BASIC',
    'ALLOWANCE',
    'BONUS',
    'EXTRA_PAY',
    'OVERTIME',
    'DEDUCTION',
    'STATUTORY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE component_frequency AS ENUM (
    'FIXED',
    'VARIABLE',
    'PERCENTAGE',
    'FORMULA'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS payroll_components (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type component_type NOT NULL,
  frequency component_frequency NOT NULL DEFAULT 'FIXED',
  is_taxable BOOLEAN NOT NULL DEFAULT false,
  is_pensionable BOOLEAN NOT NULL DEFAULT false,
  is_nhf_applicable BOOLEAN NOT NULL DEFAULT false,
  percentage_base TEXT,
  percentage_value NUMERIC(5,2),
  display_on_payslip BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_components_percentage_base_check
    CHECK (percentage_base IS NULL OR percentage_base IN ('BASIC', 'GROSS')),
  CONSTRAINT payroll_components_code_format_check
    CHECK (code ~ '^[A-Z][A-Z0-9_]*$')
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_components_tenant_code_key
  ON payroll_components(tenant_id, code);

CREATE INDEX IF NOT EXISTS payroll_components_tenant_active_idx
  ON payroll_components(tenant_id, is_active, sort_order);

CREATE TABLE IF NOT EXISTS employee_components (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  amount NUMERIC(15,2),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_components_unique_effective
    UNIQUE(employee_id, component_id, effective_from),
  CONSTRAINT employee_components_date_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS employee_components_employee_effective_idx
  ON employee_components(employee_id, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS employee_components_tenant_component_idx
  ON employee_components(tenant_id, component_id);

CREATE TABLE IF NOT EXISTS payroll_run_components (
  id TEXT PRIMARY KEY,
  payroll_run_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_components_unique
    UNIQUE(payroll_run_id, employee_id, component_id)
);

CREATE INDEX IF NOT EXISTS payroll_run_components_run_employee_idx
  ON payroll_run_components(payroll_run_id, employee_id);

CREATE INDEX IF NOT EXISTS payroll_run_components_component_idx
  ON payroll_run_components(component_id);
