import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side gate for protected areas (Next.js 16 "proxy" file —
 * the renamed middleware convention).
 *
 * Runs BEFORE the route renders, so unauthenticated visitors get a
 * redirect instead of a flash of the client-side "checking session"
 * screen. This is a presence check only: the cookie's HMAC
 * signature and the single-active-session rule are still verified
 * by /api/me on every request.
 *
 * NOTE: the cookie name is hardcoded here rather than imported from
 * lib/auth-server — that module pulls in Node's crypto, which is
 * not available in this edge-runtime context.
 */
const SESSION_COOKIE = 'stenotype_session';

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/admin/:path*'],
};
