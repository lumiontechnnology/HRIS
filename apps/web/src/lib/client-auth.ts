'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchDashboardApi } from '@/lib/dashboard-api';
import type { SupabaseClient, User } from '@supabase/supabase-js';

interface CurrentUser {
  id: string;
  email: string | undefined;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  tenantId: string;
  role: string;
  roles: string[];
}

type PermissionLike = {
  resource?: string;
  action?: string;
  name?: string;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
};

const toPermissionSet = (value: unknown): Set<string> => {
  const permissionSet = new Set<string>();

  if (!Array.isArray(value)) {
    return permissionSet;
  }

  for (const item of value) {
    if (typeof item === 'string') {
      permissionSet.add(normalize(item));
      continue;
    }

    if (typeof item === 'object' && item !== null) {
      const permission = item as PermissionLike;
      if (typeof permission.name === 'string') {
        permissionSet.add(normalize(permission.name));
      }

      if (typeof permission.resource === 'string' && typeof permission.action === 'string') {
        permissionSet.add(`${normalize(permission.resource)}:${normalize(permission.action)}`);
      }
    }
  }

  return permissionSet;
};

const getPermissionsFromUser = (user: User | null): Set<string> => {
  if (!user) {
    return new Set<string>();
  }

  const appMetaPermissions = toPermissionSet(user.app_metadata?.permissions);
  const userMetaPermissions = toPermissionSet(user.user_metadata?.permissions);

  return new Set<string>([...appMetaPermissions, ...userMetaPermissions]);
};

const getRolesFromUser = (user: User | null): Set<string> => {
  if (!user) {
    return new Set<string>();
  }

  const roles = [
    ...toStringArray(user.app_metadata?.roles),
    ...toStringArray(user.user_metadata?.roles),
    ...(typeof user.app_metadata?.role === 'string' ? [user.app_metadata.role] : []),
    ...(typeof user.user_metadata?.role === 'string' ? [user.user_metadata.role] : []),
  ];

  return new Set<string>(roles.map(normalize));
};

const includesPermission = (permissions: Set<string>, resource: string, action: string): boolean => {
  const normalizedResource = normalize(resource);
  const normalizedAction = normalize(action);

  return (
    permissions.has(`${normalizedResource}:${normalizedAction}`) ||
    permissions.has(`${normalizedResource}:*`) ||
    permissions.has(`*:${normalizedAction}`) ||
    permissions.has('*:*')
  );
};

function useSupabaseAuthState() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const initialize = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      setIsLoading(false);
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return { user, isLoading };
}

export function useRequireAuth() {
  const { user, isLoading } = useSupabaseAuthState();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/sign-in');
    }
  }, [isLoading, user, router]);

  return { isSignedIn: !!user, isLoading };
}

export function usePermission() {
  const { user } = useSupabaseAuthState();

  const hasPermission = (resource: string, action: string): boolean => {
    const permissions = getPermissionsFromUser(user);
    if (permissions.size === 0) {
      return false;
    }

    return includesPermission(permissions, resource, action);
  };

  const hasAnyPermission = (permissionsToCheck: string[]): boolean => {
    const permissions = getPermissionsFromUser(user);
    if (permissions.size === 0) {
      return false;
    }

    return permissionsToCheck.map((permission) => normalize(permission)).some((permission) => permissions.has(permission));
  };

  const hasAllPermissions = (permissionsToCheck: string[]): boolean => {
    const permissions = getPermissionsFromUser(user);
    if (permissions.size === 0) {
      return false;
    }

    return permissionsToCheck.map((permission) => normalize(permission)).every((permission) => permissions.has(permission));
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}

export function useRole() {
  const { user } = useSupabaseAuthState();

  const hasRole = (rolesToCheck: string[]): boolean => {
    const roles = getRolesFromUser(user);
    if (roles.size === 0) {
      return false;
    }

    return rolesToCheck.map((role) => normalize(role)).some((role) => roles.has(role));
  };

  const hasAllRoles = (rolesToCheck: string[]): boolean => {
    const roles = getRolesFromUser(user);
    if (roles.size === 0) {
      return false;
    }

    return rolesToCheck.map((role) => normalize(role)).every((role) => roles.has(role));
  };

  return { hasRole, hasAllRoles };
}

export function useCurrentUser() {
  const { user, isLoading } = useSupabaseAuthState();
  const [resolvedRole, setResolvedRole] = useState<string | null>(null);
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [isRoleResolved, setIsRoleResolved] = useState(false);

  const metadataTenantId =
    (user?.user_metadata?.tenantId as string | undefined) ||
    (user?.app_metadata?.tenantId as string | undefined) ||
    '';
  const tenantId = metadataTenantId || resolvedTenantId || '';

  const rawRoles = [
    ...toStringArray(user?.app_metadata?.roles),
    ...toStringArray(user?.user_metadata?.roles),
    ...(typeof user?.app_metadata?.role === 'string' ? [user.app_metadata.role] : []),
    ...(typeof user?.user_metadata?.role === 'string' ? [user.user_metadata.role] : []),
  ];
  const roles = Array.from(new Set(rawRoles.map((role) => role.trim().toUpperCase())));
  const roleKey = roles.join('|');

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setResolvedRole(null);
      setResolvedTenantId(null);
      setIsRoleResolved(false);
      return;
    }

    const fallbackRole = roles[0] || 'EMPLOYEE';

    const hydrateRole = async () => {
      try {
        const response = await fetchDashboardApi<{ success: boolean; data?: { role?: string; tenantId?: string } }>(
          '/api/v1/me/profile',
          { id: user.id, tenantId: metadataTenantId }
        );

        const apiRole = response.data?.role?.trim().toUpperCase();
        const apiTenantId = response.data?.tenantId?.trim();
        if (!cancelled) {
          setResolvedRole(apiRole || fallbackRole);
          if (apiTenantId) {
            setResolvedTenantId(apiTenantId);
          }
          setIsRoleResolved(true);
        }
      } catch {
        if (!cancelled) {
          setResolvedRole(fallbackRole);
          setResolvedTenantId(metadataTenantId || null);
          setIsRoleResolved(true);
        }
      }
    };

    void hydrateRole();

    return () => {
      cancelled = true;
    };
  }, [roleKey, metadataTenantId, user?.id]);

  const role = resolvedRole || roles[0] || 'EMPLOYEE';

  return {
    user: user
      ? ({
          id: user.id,
          email: user.email,
          firstName: (user.user_metadata?.firstName as string | null) ?? null,
          lastName: (user.user_metadata?.lastName as string | null) ?? null,
          imageUrl: (user.user_metadata?.avatar_url as string | undefined) ?? '',
          tenantId,
          role,
          roles,
        } as CurrentUser)
      : null,
    isLoading,
    isAuthenticated: !!user,
    isRoleResolved,
  };
}
