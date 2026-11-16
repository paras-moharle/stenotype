import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, revokeToken } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Revoke unconditionally — revokeSessionByToken is safe on any
    // token string (unknown tokens are simply recorded as revoked).
    // The cookie is cleared below regardless.
    try {
      revokeToken(token);
    } catch {
      // Ignore — we still clear the cookie below.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

