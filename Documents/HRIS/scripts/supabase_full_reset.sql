-- WARNING: This is destructive. It deletes all app tables/data, auth users, and storage metadata.

-- 1) Remove storage buckets using supported Storage functions
DO $$
DECLARE
  bucket_record RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    FOR bucket_record IN
      SELECT id
      FROM storage.buckets
    LOOP
      PERFORM storage.empty_bucket(bucket_record.id);
      PERFORM storage.delete_bucket(bucket_record.id);
    END LOOP;
  END IF;
END
$$;

-- 2) Remove auth users/identities (safe if auth schema exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'auth'
  ) THEN
    DELETE FROM auth.identities;
    DELETE FROM auth.users;
  END IF;
END
$$;

-- 3) Reset public schema completely
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 4) Restore Supabase standard grants on public schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 5) Default privileges for objects created by postgres in public
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON TABLES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON FUNCTIONS TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT ALL ON SEQUENCES TO postgres, service_role;
