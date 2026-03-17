/**
 * Clerk Authentication Configuration
 * Handles server-side and client-side authentication with Clerk
 */

import { currentUser, auth } from "@clerk/nextjs";
import { PrismaClient } from "@lumion/database";

const prisma = new PrismaClient();

/**
 * Get the current authenticated user with tenant and role information
 */
export async function getCurrentUser() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // Get user data from Prisma with roles and permissions
  const dbUser = await prisma.user.findUnique({
    where: { clerkUserId: user.id },
    include: {
      tenant: true,
      roles: {
        include: {
          permissions: true,
        },
      },
      employee: true,
    },
  });

  if (!dbUser || !dbUser.isActive) {
    return null;
  }

  // Extract permissions from roles
  const permissions = dbUser.roles.flatMap((role: any) =>
    role.permissions.map((perm: any) => `${perm.resource}:${perm.action}`)
  );

  return {
    id: dbUser.id,
    clerkUserId: user.id,
    email: dbUser.email,
    firstName: dbUser.firstName,
    lastName: dbUser.lastName,
    avatar: dbUser.avatar || user.imageUrl,
    tenantId: dbUser.tenantId,
    tenant: dbUser.tenant,
    roles: dbUser.roles.map((r: any) => r.name),
    permissions,
    employee: dbUser.employee,
  };
}

/**
 * Get auth token for API requests
 * Clerk provides a session token that can be used for API authentication
 */
export async function getAuthToken() {
  const { getToken } = auth();
  return await getToken({ template: "integration_convex" });
}

/**
 * Verify that user belongs to a specific tenant
 */
export async function verifyTenantAccess(tenantId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  return user.tenantId === tenantId;
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(permission: string) {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}

/**
 * Check if user has a specific role
 */
export async function checkRole(role: string) {
  const user = await getCurrentUser();

  if (!user) {
    return false;
  }

  return user.roles.includes(role);
}

/**
 * Sync user with database when they sign up or update their profile
 */
export async function syncUserWithDatabase(clerkUser: any) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId: clerkUser.id },
    });

    if (!existingUser) {
      // Create new user - they need to be assigned to a tenant
      // This is typically done through an invitation or signup flow
      console.log(
        "New user from Clerk, awaiting tenant assignment:",
        clerkUser.id
      );
      return null;
    }

    // Update user info if changed
    const updated = await prisma.user.update({
      where: { clerkUserId: clerkUser.id },
      data: {
        email: clerkUser.emailAddresses[0]?.emailAddress || existingUser.email,
        firstName: clerkUser.firstName || existingUser.firstName,
        lastName: clerkUser.lastName || existingUser.lastName,
        avatar: clerkUser.imageUrl || existingUser.avatar,
        lastLogin: new Date(),
      },
      include: {
        tenant: true,
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    return updated;
  } catch (error) {
    console.error("Error syncing user with database:", error);
    throw error;
  }
}
