import { parseYouTubeId } from '../youtube';
/**
 * Validation for admin payloads.
 *
 * The frontend and the API share these schemas, so a form can never send
 * something the route rejects. They are pure Zod — no React, no Prisma —
 * and are unit-tested in tests/admin-schemas.test.mjs.
 */

import { z } from 'zod';
import { MAX_CUSTOM_CHARS, MAX_TOKEN_CELLS, tokenizeScored, normalizeText } from '../typing/scoring';

/* ─── Shared ─────────────────────────────────────────────── */

export const dictationCategorySchema = z.enum([
  'GENERAL',
  'PROFESSIONAL',
  'LEGAL',
]);

export const dictationStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);

export const studentStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

/**
 * YouTube ids are optional. The admin form sends `null` (or an empty
 * string) when no video exists — that must be accepted, not rejected.
 * An absent key stays absent so a PATCH-style update can ignore it.
 */
export const youtubeIdSchema = z
  .union([z.string().trim().refine((id) => !id || parseYouTubeId(id) !== null, 'Enter a YouTube link or an 11-character video ID'), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === null || value.length === 0 ? null : parseYouTubeId(value);
  });

const transcriptSchema = z
  .string()
  .trim()
  .min(1, 'Transcript is required')
  .max(50_000, 'Transcript is too long');

export function publicationTranscriptError(transcript: string): string | undefined {
  const normalized = normalizeText(transcript);
  if (normalized.length > MAX_CUSTOM_CHARS) {
    return `Published transcripts can contain at most ${MAX_CUSTOM_CHARS} characters after whitespace normalization.`;
  }
  const tokenLimit = Math.floor(Math.sqrt(MAX_TOKEN_CELLS)) - 1;
  if (tokenizeScored(normalized).length > tokenLimit) {
    return `Published transcripts can contain at most ${tokenLimit} scored items.`;
  }
}

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title is too long');

const durationSchema = z.number().int().positive().max(2_147_483_647).nullable().optional();

/* ─── Dictations ─────────────────────────────────────────── */

export const createDictationSchema = z.object({
  title: titleSchema,
  category: dictationCategorySchema,
  referenceTranscript: transcriptSchema,
  youtubeId: youtubeIdSchema,
  durationSeconds: durationSchema,
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
}).superRefine((value, ctx) => {
  if (value.status !== 'PUBLISHED') return;
  const error = publicationTranscriptError(value.referenceTranscript);
  if (error) ctx.addIssue({ code: 'custom', path: ['referenceTranscript'], message: error });
});

export const updateDictationSchema = z
  .object({
    title: titleSchema.optional(),
    category: dictationCategorySchema.optional(),
    referenceTranscript: transcriptSchema.optional(),
    youtubeId: youtubeIdSchema,
    durationSeconds: durationSchema,
    status: dictationStatusSchema.optional(),
    expectedUpdatedAt: z.iso.datetime().optional(),
  })
  .refine((value) => Object.entries(value).some(([key, entry]) => key !== 'expectedUpdatedAt' && entry !== undefined), {
    message: 'No fields to update',
  });

export type CreateDictationInput = z.infer<typeof createDictationSchema>;
export type UpdateDictationInput = z.infer<typeof updateDictationSchema>;

/* ─── Students ───────────────────────────────────────────── */

const phoneSchema = z.string().trim().max(20).nullable().optional();

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  phone: phoneSchema,
});

export const updateStudentSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: phoneSchema,
    status: studentStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'No fields to update',
  });

/* ─── Users ──────────────────────────────────────────────── */

export const banUserSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(200).nullable().optional(),
});
