import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register", "/api/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without authentication
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    // If already authenticated and trying to access auth pages, redirect to dashboard
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token) {
        const dashboardUrl = new URL("/", request.url);
        return NextResponse.redirect(dashboardUrl);
      }
    }
    return NextResponse.next();
  }

  // For API routes, require a valid JWT
  if (pathname.startsWith("/api/")) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    // Attach user info to request headers so route handlers can use it
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", String(token.userId));
    requestHeaders.set("x-user-role", String(token.role));

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // For page routes, require authentication and redirect to login
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};