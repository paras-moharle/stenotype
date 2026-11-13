import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  findAccount,
  signToken,
} from '@/lib/auth-server';
import { createSession } from '@/lib/sessions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  const user = findAccount(email, password);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const token = signToken(user.email);

  // Create/replace session — any previous session for this email is revoked.
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : undefined;
  createSession({
    email: user.email,
    token,
    ttlSeconds: SESSION_MAX_AGE_SECONDS,
    ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
