import type { PoolConfig } from 'pg';

/**
 * pg pool settings for the Prisma driver adapter.
 *
 * The pg default is 10 connections per process, and every serverless
 * instance opens its own pool. A page load can fire several parallel
 * queries (layout + page + client fetches), so an oversized pool plus
 * Neon's pooler limit is what makes Prisma wait for a free connection
 * and throw P2028. Five is plenty for this app and keeps us well inside
 * Neon's connection budget.
 *
 * `allowExitOnIdle` lets a serverless instance shut down cleanly
 * instead of being held open by an idle socket.
 *
 * `tests/auth-config.test.mjs` guards the values that prevent P2028.
 */
export const poolConfig: PoolConfig = {
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
};

// Prisma CLI and libpq consume their own URL. Only the node-postgres
// runtime adapter needs this normalization for legacy Neon URLs.
export function runtimeDatabaseUrl(raw = process.env.DATABASE_URL) {
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!url.hostname.endsWith('.neon.tech')) return raw;
  url.searchParams.set('sslmode', 'verify-full');
  return url.href;
}
