import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__secure-better-auth.session_token")?.value;

  const { pathname } = request.nextUrl;

  // Protect card editing routes
  if (pathname.startsWith("/card/edit")) {
    if (!sessionToken) {
      // Redirect to login page and preserve the destination path
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages (login / register)
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (sessionToken) {
      return NextResponse.redirect(new URL("/explore", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/card/edit/:path*", "/login", "/register"],
};
