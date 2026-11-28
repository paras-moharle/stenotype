import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const ticketLifetimeMs = 8 * 60 * 60 * 1000;
export const MAX_PRACTICE_TICKET_LENGTH = 1_600;

const ticketSchema = z.object({
  profileId: z.string().min(1),
  passageId: z.string().min(1),
  submissionKey: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  youtubeId: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  expiresAt: z.number().int(),
});

type Ticket = z.infer<typeof ticketSchema>;

function secret() {
  const key = process.env.BETTER_AUTH_SECRET;
  if (!key) throw new Error('BETTER_AUTH_SECRET is required for dictation practice.');
  return key;
}

function signature(encoded: string, key: string) {
  return createHmac('sha256', key).update('stenotype/dictation-practice/v1\0').update(encoded).digest();
}

export function dictationReferenceDigest(transcript: string) {
  return createHash('sha256').update(transcript, 'utf8').digest('hex');
}

export function issuePracticeTicket(
  claims: Omit<Ticket, 'submissionKey' | 'expiresAt'>, key = secret(), now = Date.now()
) {
  const submissionKey = randomUUID();
  const encoded = Buffer.from(JSON.stringify({ ...claims, submissionKey, expiresAt: now + ticketLifetimeMs })).toString('base64url');
  return { submissionKey, practiceTicket: encoded + '.' + signature(encoded, key).toString('base64url') };
}

export function verifyPracticeTicket(
  ticket: string, scope: Pick<Ticket, 'profileId' | 'passageId' | 'submissionKey'>, key = secret()
) {
  if (ticket.length > MAX_PRACTICE_TICKET_LENGTH) return null;
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(ticket);
  if (!match) return null;
  const [, encoded, encodedMac] = match;
  const mac = Buffer.from(encodedMac, 'base64url');
  if (!timingSafeEqual(mac, signature(encoded, key)) || mac.toString('base64url') !== encodedMac) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = ticketSchema.safeParse(payload);
  if (!result.success) return null;
  const claims = result.data;
  if (claims.profileId !== scope.profileId || claims.passageId !== scope.passageId || claims.submissionKey !== scope.submissionKey) {
    return null;
  }
  return claims;
}
