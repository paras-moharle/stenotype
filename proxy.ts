import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side gate for protected areas (Next.js 16 "proxy" file —
 * the renamed middleware convention).
 *
 * Runs BEFORE the route renders, so unauthenticated visitors get a
 * redirect instead of a flash of the client-side "checking session"
 * screen.
 *
 * This is a presence + role check: the cookie's HMAC signature is
 * verified here (Web Crypto, edge-compatible) and the token's role
 * must match the area — /admin/* requires an admin, /student/*
 * requires a student. The single-active-session / revocation rules
 * are still enforced by /api/me on every request.
 *
 * NOTE: lib/auth-server uses Node's crypto, which is not available
 * in this edge-runtime context — so the HMAC verification is
 * re-implemented here with Web Crypto. The token format
 * (base64url(payload).base64url(hmac-sha256)) is shared.
 */
const SESSION_COOKIE = 'stenotype_session';

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Verify the token signature and return its email, or null. */
async function verifiedEmail(token: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as { email?: unknown; exp?: unknown };
    if (typeof parsed.email !== 'string') return null;
    if (typeof parsed.exp === 'number' && parsed.exp <= Date.now()) {
      return null;
    }
    return parsed.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

function roleForEmail(email: string): 'admin' | 'student' | null {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const studentEmail = process.env.STUDENT_EMAIL?.trim().toLowerCase();
  if (adminEmail && email === adminEmail) return 'admin';
  if (studentEmail && email === studentEmail) return 'student';
  return null;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const email = await verifiedEmail(token);
  const role = email ? roleForEmail(email) : null;

  // Unknown / invalid / expired token, or an email with no account.
  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role must match the area — no cross-area browsing.
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/student/dashboard', request.url));
  }
  if (pathname.startsWith('/student') && role !== 'student') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student', '/student/:path*', '/admin', '/admin/:path*'],
};

