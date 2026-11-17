import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

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
export async function POST() {
  try {
    const response = await auth.api.signOut({
      headers: await headers(),
      asResponse: true,
    });

    const forwarded = new Headers({
      'Cache-Control': 'no-store',
    });

    // getSetCookie() keeps the cookies separate. Folding several
    // Set-Cookie values into one header (via .get()) corrupts them,
    // because the values themselves may contain commas.
    for (const cookie of response.headers.getSetCookie()) {
      forwarded.append('set-cookie', cookie);
    }

    return NextResponse.json({ success: true }, { headers: forwarded });
  } catch {
    // The user is signing out either way; the client also clears its
    // own UI state and redirects.
    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
