import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { canAccessRoute, canAccessRouteWithGrants, normalizeRole } from "@/lib/rbac/permissions";

const publicPaths = ["/login", "/register", "/api/auth", "/forbidden"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token) {
        return NextResponse.redirect(new URL("/animals/dashboard", request.url));
      }
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = normalizeRole(String(token.role ?? "VIEWER"));
  const tokenPermissions = token.permissions as string[] | undefined;
  const routeAllowed = tokenPermissions?.length
    ? canAccessRouteWithGrants(new Set(tokenPermissions), pathname)
    : canAccessRoute(role, pathname);

  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", String(token.userId));
    requestHeaders.set("x-user-role", role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!routeAllowed) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
