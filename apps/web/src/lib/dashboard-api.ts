export interface DashboardUserContext {
  id: string;
  tenantId: string;
}

/**
 * Fetches data from the Hono API via the server-side Next.js proxy.
 *
 * Auth (x-user-id / x-tenant-id) is injected by the proxy using the
 * server-side Supabase session — it is NOT sent from the browser.
 * The `user` parameter is accepted for backward compatibility but ignored.
 *
 * Paths must start with /api/v1/ (e.g. '/api/v1/attendance/today').
 */
export async function fetchDashboardApi<T>(
  path: string,
  _user?: DashboardUserContext,
  init?: RequestInit
): Promise<T> {
  // Route through the Next.js proxy instead of calling the Hono API directly.
  // /api/v1/foo/bar → /api/proxy/foo/bar
  const proxyPath = path.replace(/^\/api\/v1/, '/api/proxy');

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(proxyPath, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}
