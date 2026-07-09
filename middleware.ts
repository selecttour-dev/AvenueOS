import { NextRequest, NextResponse } from "next/server";

// Redirect to the venue picker when no venue cookie is set.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/select") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }
  if (!req.cookies.get("venue")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/select";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
