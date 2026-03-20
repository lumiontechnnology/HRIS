-- Strict tenant isolation RLS migration for Supabase
-- Applies to every table in schema public that has tenant_id or tenantId column.
-- Profiles is handled separately to avoid self-referential policy recursion.

BEGIN;

-- Resolve current tenant id from the authenticated profile.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id::text
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- Profiles table: each user can read/update only their own profile.
-- NOTE: keep this policy explicit; do not use current_tenant_id() here.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_select
ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY profiles_self_update
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Apply strict tenant isolation to all tenant-scoped tables.
DO $$
DECLARE
  r RECORD;
  tenant_expr text;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('tenant_id', 'tenantId')
      AND c.table_name <> 'profiles'
  LOOP
    tenant_expr := format('%I::text = public.current_tenant_id()', r.column_name);

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I.%I', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I.%I', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I.%I', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I.%I', r.table_schema, r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I.%I FOR SELECT USING (%s)',
      r.table_schema,
      r.table_name,
      tenant_expr
    );

    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I.%I FOR INSERT WITH CHECK (%s)',
      r.table_schema,
      r.table_name,
      tenant_expr
    );

    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)',
      r.table_schema,
      r.table_name,
      tenant_expr,
      tenant_expr
    );

    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I.%I FOR DELETE USING (%s)',
      r.table_schema,
      r.table_name,
      tenant_expr
    );
  END LOOP;
END
$$;

COMMIT;
