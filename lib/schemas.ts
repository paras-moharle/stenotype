/**
 * Zod schemas — single source of truth for every form and API
 * payload in the StenoType application.
 *
 * Why this file exists
 * --------------------
 * The frontend (admin forms) and the future backend (API
 * routes, server actions) will both need to validate the same
 * data. By writing the Zod schemas once and importing them
 * in both places we guarantee they stay in lock-step — the
 * admin can never submit a payload the API will reject.
 *
 * This file is intentionally framework-light. It contains pure
 * Zod schemas with no React, no Next.js, no Prisma imports.
 * That means it can be safely used in:
 *
 *   - client components  (form validation, inline errors)
 *   - server actions     (re-validate before mutating)
 *   - API route handlers (request body validation)
 *   - unit tests         (no need to spin up a renderer)
 *
 * How to use
 * ----------
 * 1. Define the schema in this file.
 * 2. In a client form: use `zodResolver(schema)` from
 *    `@hookform/resolvers/zod` with `react-hook-form`.
 * 3. In a server action / API route: call `schema.parse(body)`
 *    or `schema.safeParse(body)` and handle the result.
 *
 * Schemas are grouped by domain. Each group mirrors a Prisma
 * model that will exist in the future schema.
 */

import { z } from 'zod';

/* ─── Shared primitives ──────────────────────────────────── */

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

export const phoneSchema = z
  .string()
  .min(10, 'Phone number is too short')
  .max(15, 'Phone number is too long')
  .regex(/^[+\d\s()-]+$/, 'Use digits, spaces, + ( ) -');

export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be 80 characters or fewer');

export const amountSchema = z
  .number({ invalid_type_error: 'Enter an amount' })
  .int('Amount must be a whole number')
  .min(0, 'Amount cannot be negative')
  .max(1_00_00_000, 'Amount is too large');

/* ─── Auth (login + future Better Auth) ─────────────────── */

/**
 * The sign-in form on `/login` and the future
 * Better Auth sign-in API route share this schema.
 */
export const loginSchema = z.object({
  email: emailSchema,
  // Must match Better Auth's minPasswordLength (8) in lib/auth.ts.
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ─── Student ───────────────────────────────────────────── */

export const studentStatusSchema = z.enum(['Active', 'Inactive', 'Suspended']);
export type StudentStatus = z.infer<typeof studentStatusSchema>;



/* ─── Batch ─────────────────────────────────────────────── */



/* ─── Dictation ─────────────────────────────────────────── */

export const dictationCategorySchema = z.enum(['General', 'Professional', 'Legal']);
export type DictationCategory = z.infer<typeof dictationCategorySchema>;

export const dictationStatusSchema = z.enum(['Draft', 'Published', 'Archived']);
export type DictationStatus = z.infer<typeof dictationStatusSchema>;

export const dictationAssignmentSchema = z.enum([
  'All',
  'Batch A',
  'Batch B',
  'Batch C',
  'Batch D',
  'Individual',
]);
export type DictationAssignment = z.infer<typeof dictationAssignmentSchema>;



/* ─── Typing passage ────────────────────────────────────── */



/**
 * The "paste your own passage" feature (class-only, future).
 * The student pastes any text and the engine validates their
 * transcription against it using the same scoring code path
 * as the curated passage library.
 */


/* ─── Fee ───────────────────────────────────────────────── */

export const feeStatusSchema = z.enum(['Paid', 'Pending', 'Overdue']);
export type FeeStatus = z.infer<typeof feeStatusSchema>;



/* ─── Schedule ──────────────────────────────────────────── */

export const scheduleItemSchema = z
  .object({
    dictationId: z.string().min(1, 'Select a dictation'),
    audience: z.string().min(1, 'Select an audience'),
    startsAt: z.string().min(1, 'Pick a start date and time'),
    endsAt: z.string().min(1, 'Pick an end date and time'),
  })
  .refine(
    (data) =>
      new Date(data.startsAt).getTime() < new Date(data.endsAt).getTime(),
    {
      message: 'End time must be after start time',
      path: ['endsAt'],
    }
  );
export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;

/* ─── Settings ──────────────────────────────────────────── */



/* ─── Typing session submission (future API) ────────────── */

/**
 * Payload sent from the typing page to the future
 * `POST /api/sessions` route when a student finishes a test.
 * The server re-computes the score using `lib/typing/scoring.ts`
 * to make sure the client didn't tamper with the numbers.
 */
export const sessionSubmissionSchema = z.object({
  passageId: z.string().optional(),
  customText: z.string().optional(),
  // 20,000 (MAX_ALIGN_CHARS) + 40 (MAX_EXTRA_CHARS overshoot the
  // client allows) = 20,040. Must match the client's legal payload.
  typed: z.string().max(20_040),
  elapsedMs: z.number().int().nonnegative(),
  /** Client-reported WPM — server will re-verify. */
  clientWpm: z.number().int().nonnegative(),
  /** Client-reported accuracy — server will re-verify. */
  clientAccuracy: z.number().int().min(0).max(100),
  durationSetting: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  completed: z.boolean(),
});
export type SessionSubmission = z.infer<typeof sessionSubmissionSchema>;

