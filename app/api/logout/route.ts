import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/logout
 *
 * Signs out the current user by revoking their session.
 * Uses Better Auth's built-in signOut.
 */
export async function POST() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch {
    // Ignore errors — user is signing out anyway
  }

  return NextResponse.json({ success: true });
}

