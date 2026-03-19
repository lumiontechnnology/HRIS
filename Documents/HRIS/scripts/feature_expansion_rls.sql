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
