'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Hook to require authentication in client components.
 * Automatically redirects to login if not authenticated.
 */
export function useRequireAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  return { session, status, isLoading: status === 'loading' };
}

/**
 * Hook to check if user has permission
 */
export function usePermission() {
  const { data: session } = useSession();

  const hasPermission = (resource: string, action: string): boolean => {
    if (!session?.user?.permissions) return false;
    return session.user.permissions.includes(`${resource}:${action}`);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!session?.user?.permissions) return false;
    return permissions.some((p) => session.user.permissions.includes(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!session?.user?.permissions) return false;
    return permissions.every((p) => session.user.permissions.includes(p));
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}

/**
 * Hook to check if user has role
 */
export function useRole() {
  const { data: session } = useSession();

  const hasRole = (roles: string[]): boolean => {
    if (!session?.user?.roles) return false;
    return roles.some((role) => session.user.roles.includes(role));
  };

  const hasAllRoles = (roles: string[]): boolean => {
    if (!session?.user?.roles) return false;
    return roles.every((role) => session.user.roles.includes(role));
  };

  return { hasRole, hasAllRoles };
}

/**
 * Hook to get current user
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  };
}
