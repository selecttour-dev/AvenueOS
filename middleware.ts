import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets, API, and the login page itself.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1) Auth gate — must be logged in.
  if (req.cookies.get(AUTH_COOKIE)?.value !== authToken()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2) Venue picker — must have an active venue selected.
  if (!pathname.startsWith("/select") && !req.cookies.get("venue")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/select";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
