import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE,
  getUserByEmail,
  verifySession,
} from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const email = verifySession(token);
  if (!email) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
