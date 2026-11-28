/**
 * Typing submission schema — the only payload the scoring API accepts.
 *
 * Product rule: only dictation results are persisted. Free practice and
 * custom text are local-only, so there is deliberately no `customText`
 * field here: a submission without a dictation cannot be scored or
 * stored.
 *
 * The client sends what it actually produced and how long it took. It
 * does NOT send a score, a completion flag, a duration setting or an
 * attempt id — the server derives all of those (`completed` comes from
 * the computed completion, never from the browser).
 */

import { z } from 'zod';

import { MAX_ALIGN_CHARS } from './typing/scoring';
import { MAX_PRACTICE_TICKET_LENGTH } from './dictation-practice-ticket';

const MAX_TYPED_CHARS = MAX_ALIGN_CHARS;

export const attemptSubmissionSchema = z.object({
  /** Published dictation being transcribed; the server fetches its text. */
  passageId: z.string().min(1, 'A dictation is required').max(128),
  submissionKey: z.uuid(),
  practiceTicket: z.string().min(1).max(MAX_PRACTICE_TICKET_LENGTH),
  /** Exactly what the student typed. */
  typed: z.string().max(MAX_TYPED_CHARS),
  /** Wall-clock time from first keystroke to submit. */
  elapsedMs: z.number().int().nonnegative().max(2_147_483_647),
});
