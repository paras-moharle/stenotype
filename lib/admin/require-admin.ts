import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

import { rejectCrossOriginMutation } from '@/lib/mutation-request';

// Cookie caching is disabled, so the session user carries the current role.
export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

export async function requireAdmin(request?: Request): Promise<AdminGate> {
  if (request) {
    const rejection = rejectCrossOriginMutation(request);
    if (rejection) return { ok: false, response: rejection };
  }
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // A banned admin must lose API access even if a session survived.
  if (session.user.banned) {
    return {
      ok: false,
      response: Response.json(
        { error: 'This account is suspended.' },
        { status: 403 }
      ),
    };
  }

  if (session.user.role !== 'admin') {
    return {
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id };
}


export const requireAdminPage = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' || user.banned) redirect('/login?denied=1');
  return user;
});
