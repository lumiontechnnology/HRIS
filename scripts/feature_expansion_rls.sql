-- RLS policy review for feature expansion
-- Adapt these policies in your Supabase environment where tables are managed directly.

-- Employees can only read own profile, managers own team, and admins all.
CREATE POLICY employee_read_self ON employees
  FOR SELECT USING (
    user_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR')
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'MANAGER'
      AND manager_id = auth.uid()
    )
  );

-- Only role required for pending payroll approval step can action it.
CREATE POLICY payroll_approval_correct_role ON payroll_approvals
  FOR UPDATE USING (
    role_required = (SELECT role FROM profiles WHERE id = auth.uid())
    AND action = 'PENDING'
  );

-- Import/create employees reserved for HR/Super Admin.
CREATE POLICY employee_insert_hr_only ON employees
  FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Attendance read scope: self, HR roles, and line managers.
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_access ON attendance
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR', 'PAYROLL_AUDITOR')
    OR employee_id IN (
      SELECT id FROM employees
      WHERE manager_id = (SELECT id FROM employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY attendance_self_insert ON attendance
  FOR INSERT WITH CHECK (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid())
  );

-- Exit records and employment history are HR-only resources.
ALTER TABLE employee_exits ENABLE ROW LEVEL SECURITY;

CREATE POLICY exits_hr_only ON employee_exits
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR'));

ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY employment_history_hr_or_self ON employment_history
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR')
  );

ALTER TABLE offboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY offboarding_hr_or_assignee ON offboarding_tasks
  FOR SELECT USING (
    employee_id = (SELECT id FROM employees WHERE user_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR', 'FINANCE_OFFICER', 'MANAGER')
  );
