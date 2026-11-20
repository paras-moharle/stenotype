/**
 * Small helpers for turning Prisma errors into proper HTTP responses.
 *
 * Routes used to let P2025 (row not found) and P2003 (foreign-key
 * restriction) bubble up as 500s, which looks like a server crash when
 * the real answer is 404 or 409.
 */

export function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  if (!('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Record to update/delete was not found. */
export function isNotFoundError(error: unknown): boolean {
  return prismaErrorCode(error) === 'P2025';
}

/** Operation blocked by a foreign-key restriction. */
export function isForeignKeyError(error: unknown): boolean {
  return prismaErrorCode(error) === 'P2003';
}

/** Unique constraint violation (e.g. duplicate email). */
export function isUniqueViolation(error: unknown): boolean {
  return prismaErrorCode(error) === 'P2002';
}
