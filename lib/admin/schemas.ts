/**
 * Validation for admin payloads.
 *
 * The frontend and the API share these schemas, so a form can never send
 * something the route rejects. They are pure Zod — no React, no Prisma —
 * and are unit-tested in tests/admin-schemas.test.mjs.
 */

import { z } from 'zod';

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
  .union([z.string().trim().max(20), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === null || value.length === 0 ? null : value;
  });

const transcriptSchema = z
  .string()
  .trim()
  .min(1, 'Transcript is required')
  .max(50_000, 'Transcript is too long');

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title is too long');

const durationSchema = z.number().int().positive().nullable().optional();

/* ─── Dictations ─────────────────────────────────────────── */

export const createDictationSchema = z.object({
  title: titleSchema,
  category: dictationCategorySchema,
  referenceTranscript: transcriptSchema,
  youtubeId: youtubeIdSchema,
  durationSeconds: durationSchema,
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export const updateDictationSchema = z
  .object({
    title: titleSchema.optional(),
    category: dictationCategorySchema.optional(),
    referenceTranscript: transcriptSchema.optional(),
    youtubeId: youtubeIdSchema,
    durationSeconds: durationSchema,
    status: dictationStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
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
