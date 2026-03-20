/**
 * Generic server-side proxy to the Hono API.
 *
 * All /api/v1/... calls from the frontend are routed here instead of calling
 * the Hono API directly from the browser. The proxy:
 *   1. Validates the Supabase session server-side (cannot be spoofed by clients)
 *   2. Injects x-user-id / x-tenant-id headers trusted by the Hono API
 *   3. Forwards the request and streams the response back
 *
 * Server-side env var: API_URL (not NEXT_PUBLIC) for secure server→server calls.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAuthedUserWithTenant } from '@/lib/auth/tenant';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.API_URL || 'http://localhost:3001';

async function proxyRequest(
  req: NextRequest,
  context: { params: { path: string[] } }
): Promise<NextResponse> {
  const actor = await getAuthedUserWithTenant(req);

  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const segments = context.params.path ?? [];
  const tailPath = segments.join('/');
  const search = req.nextUrl.searchParams.toString();
  const targetUrl = `${API_BASE}/api/v1/${tailPath}${search ? `?${search}` : ''}`;

  const forwardHeaders = new Headers({
    'content-type': 'application/json',
    'x-user-id': actor.id,
    'x-tenant-id': actor.tenantId,
  });

  // Forward any extra request headers the Hono API might need
  const allowedForwardHeaders = ['accept', 'accept-language', 'x-forwarded-for'];
  for (const name of allowedForwardHeaders) {
    const value = req.headers.get(name);
    if (value) forwardHeaders.set(name, value);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.text() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch {
    return NextResponse.json(
      { error: 'API service unavailable' },
      { status: 503 }
    );
  }

  // Use arrayBuffer so binary responses (e.g. PDF, CSV) are not corrupted.
  const responseData = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('content-type') ?? 'application/json';

  return new NextResponse(responseData, {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
