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

/** Engine cap (MAX_ALIGN_CHARS) + the client's legal overshoot. */
const MAX_TYPED_CHARS = 20_040;

export const attemptSubmissionSchema = z.object({
  /** Published dictation being transcribed; the server fetches its text. */
  passageId: z.string().min(1, 'A dictation is required'),
  /** Exactly what the student typed. */
  typed: z.string().max(MAX_TYPED_CHARS),
  /** Wall-clock time from first keystroke to submit. */
  elapsedMs: z.number().int().nonnegative(),
});

export type AttemptSubmission = z.infer<typeof attemptSubmissionSchema>;
