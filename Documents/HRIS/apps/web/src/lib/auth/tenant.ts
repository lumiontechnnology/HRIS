import { NextRequest } from 'next/server';
import { prisma } from '@lumion/database';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuthedTenantProfile {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string;
}

export async function getAuthedUserWithTenant(_req: NextRequest): Promise<AuthedTenantProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Preferred path: read tenant context from profiles table keyed by auth user id.
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, tenant_id, email, full_name')
      .eq('id', user.id)
      .single();

    if (profile?.tenant_id) {
      return {
        id: String(profile.id || user.id),
        authUserId: user.id,
        email: String(profile.email || user.email || ''),
        fullName: String(profile.full_name || user.user_metadata?.full_name || ''),
        role: String(profile.role || 'EMPLOYEE'),
        tenantId: String(profile.tenant_id),
      };
    }
  } catch {
    // Fall back to local user table if profiles table is unavailable.
  }

  const appUser = await prisma.user.findUnique({
    where: { authUserId: user.id },
    include: { roles: true },
  });

  if (!appUser) {
    return null;
  }

  if (!appUser.tenantId) {
    return null;
  }

  const role = appUser.roles[0]?.name || 'EMPLOYEE';

  return {
    id: appUser.id,
    authUserId: appUser.authUserId,
    email: appUser.email,
    fullName: `${appUser.firstName} ${appUser.lastName}`.trim(),
    role,
    tenantId: appUser.tenantId,
  };
}
