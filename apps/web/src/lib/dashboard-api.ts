export interface DashboardUserContext {
  id: string;
  tenantId: string;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export async function fetchDashboardApi<T>(
  path: string,
  user?: DashboardUserContext,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (user?.id) {
    headers.set('x-user-id', user.id);
  }

  if (user?.tenantId) {
    headers.set('x-tenant-id', user.tenantId);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}
