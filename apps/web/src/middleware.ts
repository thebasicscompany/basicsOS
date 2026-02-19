import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Protect all dashboard routes. Better Auth session cookie is named
// "better-auth.session_token" by default.
export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;

  // Public paths — always allow
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__session");

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
