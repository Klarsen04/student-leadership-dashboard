import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/calendar", "/analytics", "/reflections"];

function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let binary = "";
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isProtected) {
    const sessionToken =
      request.cookies.get("next-auth.session-token") ??
      request.cookies.get("__Secure-next-auth.session-token");
    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = generateNonce();

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|register-sw.js|api/auth).*)",
  ],
};
