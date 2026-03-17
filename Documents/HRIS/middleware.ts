/**
 * Clerk Middleware
 * Protects routes and ensures proper authentication
 */

import { clerkMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// All routes except public ones are protected
export default clerkMiddleware((auth: any, req: any) => {
  if (!auth.userId && !isPublicRoute(req.nextUrl.pathname)) {
    // Redirect to sign in
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    "/",
    "/sign-in",
    "/sign-up",
    "/api/health",
    "/api/webhooks/clerk",
  ];

  return (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/api/webhooks/clerk")
  );
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
