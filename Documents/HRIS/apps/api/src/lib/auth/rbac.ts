import type { Context } from 'hono';
import type { AppEnv } from '../../index.js';

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    employees: ['create', 'read', 'update', 'delete', 'export', 'import'],
    payroll: ['create', 'read', 'update', 'approve', 'disburse', 'audit'],
    leave: ['create', 'read', 'update', 'approve'],
    reports: ['read', 'export'],
    settings: ['read', 'update'],
    roles: ['assign', 'revoke'],
  },
  HR_ADMIN: {
    employees: ['create', 'read', 'update', 'export', 'import'],
    payroll: ['create', 'read', 'update', 'approve:step1'],
    leave: ['read', 'approve'],
    reports: ['read', 'export'],
    settings: ['read'],
    roles: [],
  },
  HEAD_OF_HR: {
    employees: ['read', 'export'],
    payroll: ['read', 'approve:step2'],
    leave: ['read', 'approve'],
    reports: ['read', 'export'],
    settings: [],
    roles: [],
  },
  PAYROLL_AUDITOR: {
    employees: ['read'],
    payroll: ['read', 'approve:step3'],
    leave: ['read'],
    reports: ['read', 'export'],
    settings: [],
    roles: [],
  },
  FINANCE_OFFICER: {
    employees: ['read'],
    payroll: ['read', 'disburse'],
    leave: [],
    reports: ['read', 'export'],
    settings: [],
    roles: [],
  },
  MANAGER: {
    employees: ['read:own_team'],
    payroll: ['read:own_team'],
    leave: ['read:own_team', 'approve:own_team'],
    reports: ['read:own_team'],
    settings: [],
    roles: [],
  },
  EMPLOYEE: {
    employees: ['read:self'],
    payroll: ['read:self'],
    leave: ['create:self', 'read:self'],
    reports: [],
    settings: ['read:self'],
    roles: [],
  },
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;

const normalizeRole = (role: string): Role | null => {
  const candidate = role.trim().toUpperCase();
  return candidate in ROLE_PERMISSIONS ? (candidate as Role) : null;
};

export function getRolesFromContext(c: Context<AppEnv>): Role[] {
  const user = c.get('user');
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const normalized = roles
    .map((role) => normalizeRole(String(role)))
    .filter((role): role is Role => role !== null);

  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  return ['EMPLOYEE'];
}

export function hasAnyRole(c: Context<AppEnv>, allowedRoles: Role[]): boolean {
  const roleSet = new Set(getRolesFromContext(c));
  return allowedRoles.some((role) => roleSet.has(role));
}

export function requireAnyRole(c: Context<AppEnv>, allowedRoles: Role[]) {
  if (hasAnyRole(c, allowedRoles)) {
    return null;
  }

  return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403);
}

export function canAccessEmployee(
  viewerRoles: Role[],
  viewerUserId: string,
  targetUserId: string | null | undefined,
  targetManagerUserId: string | null | undefined
): boolean {
  if (viewerRoles.some((role) => ['SUPER_ADMIN', 'HR_ADMIN', 'HEAD_OF_HR'].includes(role))) {
    return true;
  }

  if (viewerRoles.includes('MANAGER') && targetManagerUserId && targetManagerUserId === viewerUserId) {
    return true;
  }

  if (viewerRoles.includes('EMPLOYEE') && targetUserId && targetUserId === viewerUserId) {
    return true;
  }

  return false;
}

export function hasPermission(c: Context<AppEnv>, resource: keyof (typeof ROLE_PERMISSIONS)[Role], action: string): boolean {
  const roles = getRolesFromContext(c);
  return roles.some((role) => {
    const permissions = ROLE_PERMISSIONS[role][resource] as readonly string[];
    return permissions.includes(action);
  });
}