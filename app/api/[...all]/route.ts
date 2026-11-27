import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { readJson, rejectCrossOriginMutation } from '@/lib/mutation-request';
import { takeSharedQuota } from '@/lib/shared-rate-limit';
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
