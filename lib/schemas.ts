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
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'admin']).default('student'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/* ─── Student ───────────────────────────────────────────── */

export const studentStatusSchema = z.enum(['Active', 'Inactive', 'Suspended']);
export type StudentStatus = z.infer<typeof studentStatusSchema>;

export const studentSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional(),
  batchId: z.string().min(1, 'Select a batch'),
  status: studentStatusSchema.default('Active'),
  notes: z.string().max(500).optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;

/* ─── Batch ─────────────────────────────────────────────── */

export const batchSchema = z.object({
  name: z
    .string()
    .min(1, 'Batch name is required')
    .max(40, 'Batch name is too long'),
  schedule: z
    .string()
    .min(1, 'Schedule is required')
    .max(80, 'Schedule is too long'),
  time: z
    .string()
    .min(1, 'Time is required')
    .regex(/^\d{1,2}:\d{2}\s*(AM|PM)?$/i, 'Use a time like 6:00 PM'),
  status: z.enum(['Active', 'Archived']).default('Active'),
});
export type BatchInput = z.infer<typeof batchSchema>;

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

export const dictationSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title is too long'),
  category: dictationCategorySchema,
  status: dictationStatusSchema.default('Draft'),
  assignedTo: dictationAssignmentSchema.default('All'),
  availableFrom: z.string().min(1, 'Pick a start date'),
  availableUntil: z.string().min(1, 'Pick an end date'),
  referenceTranscript: z
    .string()
    .min(20, 'Transcript is too short')
    .max(20_000, 'Transcript is too long'),
  /** Cloudflare R2 object key — filled in after upload. */
  audioKey: z.string().optional(),
  /** Duration in seconds — derived from the audio file. */
  durationSeconds: z.number().int().positive().optional(),
});
export type DictationInput = z.infer<typeof dictationSchema>;

/* ─── Typing passage ────────────────────────────────────── */

export const typingPassageSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title is too long'),
  category: dictationCategorySchema,
  text: z
    .string()
    .refine(
      (t) => t.trim().split(/\s+/).filter(Boolean).length >= 10,
      'Passage must be at least 10 words'
    )
    .refine(
      (t) => t.trim().split(/\s+/).filter(Boolean).length <= 500,
      'Passage is too long'
    ),
  status: dictationStatusSchema.default('Draft'),
});
export type TypingPassageInput = z.infer<typeof typingPassageSchema>;

/**
 * The "paste your own passage" feature (class-only, future).
 * The student pastes any text and the engine validates their
 * transcription against it using the same scoring code path
 * as the curated passage library.
 */
export const customPassageSchema = z.object({
  text: z
    .string()
    .refine(
      (t) => t.trim().split(/\s+/).filter(Boolean).length >= 10,
      'Paste at least 10 words of text'
    )
    .refine(
      (t) => t.trim().split(/\s+/).filter(Boolean).length <= 2_000,
      'Text is too long'
    ),
  title: z.string().max(120).optional(),
});
export type CustomPassageInput = z.infer<typeof customPassageSchema>;

/* ─── Fee ───────────────────────────────────────────────── */

export const feeStatusSchema = z.enum(['Paid', 'Pending', 'Overdue']);
export type FeeStatus = z.infer<typeof feeStatusSchema>;

export const feeSchema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  amount: amountSchema,
  dueDate: z.string().min(1, 'Pick a due date'),
  status: feeStatusSchema.default('Pending'),
  paidDate: z.string().nullable().optional(),
  notes: z.string().max(200).optional(),
});
export type FeeInput = z.infer<typeof feeSchema>;

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

export const settingsSchema = z.object({
  siteName: z.string().min(1, 'Site name is required').max(60),
  tagline: z.string().min(1, 'Tagline is required').max(120),
  defaultDuration: z
    .number()
    .int()
    .refine((v) => [15, 30, 60].includes(v), 'Choose 15, 30, or 60 seconds'),
  defaultDictationStatus: dictationStatusSchema,
  notifyOnNewStudent: z.boolean().default(true),
  notifyOnFeePayment: z.boolean().default(true),
  weeklySummary: z.boolean().default(false),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

/* ─── Typing session submission (future API) ────────────── */

/**
 * Payload sent from the typing page to the future
 * `POST /api/sessions` route when a student finishes a test.
 * The server re-computes the score using `lib/scoring.ts`
 * to make sure the client didn't tamper with the numbers.
 */
export const sessionSubmissionSchema = z.object({
  passageId: z.string().optional(),
  customText: z.string().optional(),
  typed: z.string().max(20_000),
  elapsedMs: z.number().int().nonnegative(),
  /** Client-reported WPM — server will re-verify. */
  clientWpm: z.number().int().nonnegative(),
  /** Client-reported accuracy — server will re-verify. */
  clientAccuracy: z.number().int().min(0).max(100),
  durationSetting: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  completed: z.boolean(),
});
export type SessionSubmission = z.infer<typeof sessionSubmissionSchema>;
