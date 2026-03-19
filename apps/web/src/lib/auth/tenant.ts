import { NextRequest } from 'next/server';
import { prisma } from '@lumion/database';
import { createClient } from '@/lib/supabase/server';

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

  const appUser = await prisma.user.findUnique({
    where: { authUserId: user.id },
    include: { roles: true },
  });

  if (!appUser) {
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
