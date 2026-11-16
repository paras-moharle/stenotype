import { NextResponse, type NextRequest } from 'next/server';

/**
 * First gate for protected areas (Next.js 16 "proxy" file).
 *
 * Checks for a Better Auth session cookie and redirects to /login
 * when absent, so unauthenticated visitors never see protected
 * pages. This is a presence check only — the authoritative
 * session + role verification happens in the student/admin
 * layouts (server components calling auth.api.getSession), which
 * also catch revoked or banned sessions immediately.
 *
 * The cookie name carries the __Secure- prefix over HTTPS.
 */
const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIE_NAMES.some(
    (name) => request.cookies.get(name)?.value
  );

  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student', '/student/:path*', '/admin', '/admin/:path*'],
};

