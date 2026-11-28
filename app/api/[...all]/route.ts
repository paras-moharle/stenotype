import { after } from 'next/server';
import { getStorageCapacity } from '@/lib/db-capacity';
import { scheduleDatabaseMaintenance } from '@/lib/schedule-database-maintenance';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { readJson, rejectCrossOriginMutation } from '@/lib/mutation-request';
import { takeSharedQuota } from '@/lib/shared-rate-limit';
import { signInSnapshot } from '@/lib/admitted-sign-in';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isPublicAuthPath } from '@/lib/auth-config';
import { toNextJsHandler } from 'better-auth/next-js';
import { POST as signOut } from '../logout/route';

const handler = toNextJsHandler(auth.handler);

async function handlePublicAuth(request: Request) {
  const { pathname } = new URL(request.url);
  if (!isPublicAuthPath(pathname)) {
    return new Response(null, { status: 404 });
  }

  if (request.method === 'POST' && /\/sign-out\/?$/.test(pathname)) {
    return signOut(request);
  }
  if (request.method === 'POST' && /\/sign-in\/email\/?$/.test(pathname)) {
    const rejected = rejectCrossOriginMutation(request);
    if (rejected) return rejected;
    const payload = await readJson(request.clone(), 16_384);
    if (!payload.ok) return payload.response;
    const data = payload.data;
    if (data && typeof data === 'object' && 'email' in data && typeof data.email === 'string') {
      const secret = (await auth.$context).secret;
      const windowMs = 5 * 60_000;
      const throttle = () => Response.json({ message: 'Too many sign-in attempts. Try again in a few minutes.' }, {
        status: 429, headers: { 'Retry-After': String(windowMs / 1000) },
      });
      const key = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
      const vercelIp = process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for')?.trim()
        : undefined;
      if (vercelIp && isIP(vercelIp) && !(await takeSharedQuota(`login-ip:${key(vercelIp)}`, 100, windowMs))) {
        return throttle();
      }
      if (!(await takeSharedQuota(`login:${key(data.email.trim().toLowerCase())}`, 20, windowMs))) {
        return throttle();
      }
      const user = await db.user.findUnique({
        where: { email: data.email.trim().toLowerCase() },
        select: { id: true, role: true, updatedAt: true },
      });
      const result = await signInSnapshot.run(
        user ? { id: user.id, updatedAt: user.updatedAt.getTime(), role: user.role } : null,
        () => handler.POST(request),
      );
      scheduleDatabaseMaintenance();
      if (user && (result.status === 401 || result.status === 403)) {
        after(async () => {
          try {
            if ((await getStorageCapacity()).level === 'restricted') return;
            // Select by stable ID inside the write. A deleted account cannot
            // leave a new detached audit row after its deletion has committed.
            await db.$executeRaw`
              INSERT INTO "LoginAttempt" ("id", "email", "userId", "success")
              SELECT gen_random_uuid()::text, email, id, false
              FROM "user" WHERE id = ${user.id} FOR KEY SHARE
            `;
          } catch {
            // Audit logging cannot change the authentication outcome.
          }
        });
      }
      return result;
    }
  }
  return request.method === 'GET' ? handler.GET(request) : handler.POST(request);
}

async function publicAuth(request: Request) {
  try {
    return await handlePublicAuth(request);
  } catch (error) {
    const failure = error as {
      code?: unknown;
      meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown; kind?: unknown } } };
      cause?: { code?: unknown };
    } | null;
    const driver = failure?.meta?.driverAdapterError?.cause;
    const missingSchema = [failure?.code, failure?.meta?.code, failure?.cause?.code, driver?.originalCode, driver?.kind]
      .some(code => ['42P01', '42703', 'P2021', 'P2022', 'TableDoesNotExist', 'ColumnNotFound'].some(value => value === code));
    return Response.json({ code: missingSchema ? 'AUTH_DATABASE_SCHEMA' : 'AUTH_UNAVAILABLE' }, { status: 503 });
  }
}

export { publicAuth as GET, publicAuth as POST };
