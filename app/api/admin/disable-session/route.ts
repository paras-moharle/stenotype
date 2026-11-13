import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  getUserByEmail,
  verifySession,
} from '@/lib/auth-server';
import { revokeSession } from '@/lib/sessions';

export const runtime = 'nodejs';

async function requireAdmin(store: Awaited<ReturnType<typeof cookies>>) {
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const email = verifySession(token);
  if (!email) return null;
  const user = getUserByEmail(email);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function POST(req: Request) {
  const store = await cookies();
  const admin = await requireAdmin(store);
  if (!admin) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const revoked = revokeSession(email);

  return NextResponse.json({
    ok: true,
    email,
    revoked,
    message: revoked
      ? `Session for ${email} has been disabled. They will be logged out on next request.`
      : `No active session found for ${email}.`,
  });
}
