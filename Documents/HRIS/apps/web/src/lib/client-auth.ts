'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface CurrentUser {
  id: string;
  email: string | undefined;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  tenantId: string;
}

/**
 * Hook to require authentication in client components.
 * Automatically redirects to sign-in if not authenticated.
 */
export function useRequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  return { isSignedIn, isLoading: !isLoaded };
}

/**
 * Hook to check if user has permission
 */
export function usePermission() {
  const { user } = useUser();

  const hasPermission = (_resource: string, _action: string): boolean => {
    // TODO: Implement permission checking with Clerk metadata or custom claims
    return !!user;
  };

  const hasAnyPermission = (_permissions: string[]): boolean => {
    // TODO: Implement permission checking with Clerk metadata or custom claims
    return !!user;
  };

  const hasAllPermissions = (_permissions: string[]): boolean => {
    // TODO: Implement permission checking with Clerk metadata or custom claims
    return !!user;
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}

/**
 * Hook to check if user has role
 */
export function useRole() {
  const { user } = useUser();

  const hasRole = (_roles: string[]): boolean => {
    // TODO: Implement role checking with Clerk metadata or custom claims
    return !!user;
  };

  const hasAllRoles = (_roles: string[]): boolean => {
    // TODO: Implement role checking with Clerk metadata or custom claims
    return !!user;
  };

  return { hasRole, hasAllRoles };
}

/**
 * Hook to get current user
 */
export function useCurrentUser() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const tenantId =
    (user?.publicMetadata?.tenantId as string | undefined) ||
    (user?.unsafeMetadata?.tenantId as string | undefined) ||
    '';

  return {
    user: user
      ? ({
          id: user.id,
          email: user.emailAddresses?.[0]?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          tenantId,
        } as CurrentUser)
      : null,
    isLoading: !isLoaded,
    isAuthenticated: isSignedIn,
  };
}
