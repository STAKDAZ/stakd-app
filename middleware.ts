import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next();
  }

  // We are not enforcing auth in middleware (client-side auth)
  return NextResponse.next();
}

export const config = {
  // Only run middleware on actual pages/routes
  matcher: ["/((?!_next|favicon.ico).*)"],
};
