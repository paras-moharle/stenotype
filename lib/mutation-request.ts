import { developmentOrigins, exactOrigin } from './auth-origins';

export function rejectCrossOriginMutation(request: Request) {
  const origin = request.headers.get('origin');
  const expected = exactOrigin(process.env.BETTER_AUTH_URL) ?? new URL(request.url).origin;
  if ((origin !== null && origin !== expected && !developmentOrigins().includes(origin)) ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  return null;
}

export async function readJson(request: Request, limit: number) {
  const mediaType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return { ok: false, response: Response.json({ error: 'Expected JSON.' }, { status: 415 }) } as const;
  }

  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    if (reader) {
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        bytes += chunk.value.byteLength;
        if (bytes > limit) {
          void reader.cancel().catch(() => undefined);
          return { ok: false, response: Response.json({ error: 'Request body is too large.' }, { status: 413 }) } as const;
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
    }
    const data: unknown = JSON.parse(text + decoder.decode());
    return { ok: true, data } as const;
  } catch {
    return { ok: false, response: Response.json({ error: 'Invalid JSON.' }, { status: 400 }) } as const;
  } finally {
    reader?.releaseLock();
  }
}
