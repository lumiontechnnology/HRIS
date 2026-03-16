import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

/**
 * Ensures user is authenticated. Redirects to login if not.
 * Returns the session for type safety.
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return session;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userPermissions: string[],
  resource: string,
  action: string
): boolean {
  return userPermissions.includes(`${resource}:${action}`);
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(userRoles: string[], roles: string[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Ensure user has required permission
 */
export function requirePermission(
  userPermissions: string[],
  resource: string,
  action: string
): void {
  if (!hasPermission(userPermissions, resource, action)) {
    throw new Error(`Permission denied: ${resource}:${action}`);
  }
}

/**
 * Ensure user has required role
 */
export function requireRole(userRoles: string[], roles: string[]): void {
  if (!hasRole(userRoles, roles)) {
    throw new Error(`Role required: ${roles.join(', ')}`);
  }
}
