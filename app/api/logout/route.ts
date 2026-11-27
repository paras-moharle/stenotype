import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { rejectCrossOriginMutation } from '@/lib/mutation-request';

/**
 * POST /api/logout
 *
 * Server-side sign-out fallback. Calls Better Auth directly with the
 * incoming request headers and **forwards its Set-Cookie headers** so
 * the session cookie is actually cleared.
 *
 * This used to discard the response headers and return
 * `{ success: true }` without any Set-Cookie — a logout endpoint that
 * did not log anyone out. The client uses it as a fallback when
 * `/api/auth/sign-out` fails.
 */
export async function POST(request: Request) {
  const rejection = rejectCrossOriginMutation(request);
  if (rejection) return rejection;
  try {
    const incoming = await headers();
    const current = await auth.api.getSession({ headers: incoming, query: { disableRefresh: true } });
    if (current) {
      await db.session.deleteMany({ where: { id: current.session.id, userId: current.user.id } });
    }
    const response = await auth.api.signOut({
      headers: incoming,
      asResponse: true,
    });

    const forwarded = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    });

    // getSetCookie() keeps the cookies separate. Folding several
    // Set-Cookie values into one header (via .get()) corrupts them,
    // because the values themselves may contain commas.
    for (const cookie of response.headers.getSetCookie()) {
      forwarded.append('set-cookie', cookie);
    }

    return new Response(response.body, { status: response.status, headers: forwarded });
  } catch {
    return NextResponse.json({ error: 'Sign-out could not be confirmed.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
