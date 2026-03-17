/**
 * Clerk Middleware
 * Protects routes and ensures proper authentication
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs";
import { NextResponse } from "next/server";

const publicRoutes = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/api/health",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware((auth, req) => {
  if (!publicRoutes(req) && !auth.userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
