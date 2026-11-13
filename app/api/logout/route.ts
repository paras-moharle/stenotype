import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  revokeToken,
  verifyToken,
} from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Revoke the session from the store regardless of token validity.
    try {
      const email = verifyToken(token);
      if (email) {
        revokeToken(token);
      }
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
