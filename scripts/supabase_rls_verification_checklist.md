# Supabase RLS Verification Checklist

Use this checklist immediately after running scripts/supabase_strict_tenant_rls.sql.

## 1. Confirm tenant-scoped tables were discovered
Run:

```sql
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('tenant_id', 'tenantId')
ORDER BY table_name;
```

Expected:
- Every tenant-scoped table appears.
- No table that should be tenant-scoped is missing a tenant column.

## 2. Confirm RLS is enabled and forced
Run:

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns ic
    WHERE ic.table_schema = 'public'
      AND ic.table_name = c.relname
      AND ic.column_name IN ('tenant_id', 'tenantId')
  )
ORDER BY c.relname;
```

Expected:
- rls_enabled = true for all rows.
- rls_forced = true for all rows.

## 3. Confirm required policies exist
Run:

```sql
SELECT schemaname,
       tablename,
       policyname,
       cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE 'tenant_isolation_%'
    OR policyname LIKE 'profiles_self_%'
  )
ORDER BY tablename, policyname;
```

Expected:
- For each tenant table: tenant_isolation_select, insert, update, delete.
- For profiles: profiles_self_select and profiles_self_update.

## 4. Validate helper function
Run:

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'current_tenant_id';
```

Expected:
- Function exists.
- prosecdef = true (security definer).

## 5. Tenant isolation smoke test with two users
You need two users from different tenants:
- user_a in tenant A
- user_b in tenant B

For each user session, set the auth uid claim then query one tenant table:

```sql
SELECT set_config('request.jwt.claim.sub', '<user_a_uuid>', true);
SELECT current_tenant_id();
SELECT COUNT(*) FROM employees;
```

```sql
SELECT set_config('request.jwt.claim.sub', '<user_b_uuid>', true);
SELECT current_tenant_id();
SELECT COUNT(*) FROM employees;
```

Expected:
- Each user only sees rows from their own tenant.
- Counts differ as expected by tenant.

## 6. Cross-tenant write test
As user_a, try to insert a row with tenant_id of tenant B.

Expected:
- INSERT fails due to WITH CHECK policy.

## 7. Application sanity checks
Verify these app behaviors still work:
- Register company flow.
- Onboarding step saves.
- Invite employee.
- Dashboard loads.

Expected:
- All work only within the actor tenant.
- No cross-tenant records visible.

## 8. Final gate
Do not release unless all checks pass.
If any check fails:
- Identify table/policy mismatch.
- Patch SQL migration.
- Re-run checklist from step 1.
