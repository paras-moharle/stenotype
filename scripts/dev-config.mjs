import { isIP } from 'node:net';

export class DevConfigError extends Error {}

export const verificationHost = 'ep-holy-sun-bbvyyis1.c-15.us-east-1.aws.neon.tech';
const keys = ['DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'STENO_DEV_PORT', 'STENO_DEV_TRUSTED_ORIGINS', 'STENO_DEV_BIND'];

export function checkDevConfig(local, exported) {
  for (const key of keys) {
    if (exported[key] !== undefined && exported[key] !== local[key]) {
      throw new DevConfigError(`Exported ${key} conflicts with .env.local. Run set -e ${key} in fish or remove its startup export.`);
    }
  }
  for (const key of keys.slice(0, 3)) {
    if (!local[key]) throw new DevConfigError(`Set ${key} in .env.local before running pnpm dev.`);
  }
  const database = parseUrl(local.DATABASE_URL);
  if (!isVerificationDatabase(database)) {
    throw new DevConfigError(`DATABASE_URL must use the disposable verification host ${verificationHost} and the direct PostgreSQL port.`);
  }
  if (!/^[A-Za-z0-9_-]{43,}$/.test(local.BETTER_AUTH_SECRET)) {
    throw new DevConfigError('Set a local BETTER_AUTH_SECRET generated with openssl rand -hex 32.');
  }
  const port = Number(local.STENO_DEV_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new DevConfigError('STENO_DEV_PORT must be a valid TCP port.');
  if (exported.PORT !== undefined && Number(exported.PORT) !== port) throw new DevConfigError('Exported PORT conflicts with STENO_DEV_PORT. Run set -e PORT in fish.');
  const origin = parseOrigin(local.BETTER_AUTH_URL);
  if (origin.protocol === 'http:' && Number(origin.port || 80) !== port) {
    throw new DevConfigError('BETTER_AUTH_URL port must match STENO_DEV_PORT for HTTP development.');
  }
  const extras = (local.STENO_DEV_TRUSTED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean).map(parseOrigin);
  for (const extra of extras) {
    if (extra.protocol !== origin.protocol) throw new DevConfigError('Use the same scheme for local auth origins. To use an HTTPS tunnel, make it BETTER_AUTH_URL and remove HTTP secondary origins.');
    if (extra.protocol === 'http:' && Number(extra.port || 80) !== port) throw new DevConfigError('HTTP trusted origins must use STENO_DEV_PORT.');
  }
  const bind = local.STENO_DEV_BIND || '127.0.0.1';
  if (!isIP(bind)) throw new DevConfigError('STENO_DEV_BIND must be an IP address. Use 127.0.0.1 for localhost or 0.0.0.0 for direct LAN access.');
  return { database, port, bind, origins: [origin, ...extras] };
}

export function isVerificationDatabase(database) {
  return database && ['postgres:', 'postgresql:'].includes(database.protocol) &&
    database.hostname === verificationHost && (!database.port || database.port === '5432') &&
    database.pathname.length > 1 && Boolean(database.username) && Boolean(database.password) &&
    [...database.searchParams.keys()].every(key => key === 'sslmode' || key === 'channel_binding');
}

function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}

function parseOrigin(value) {
  const url = parseUrl(value);
  if (!url || value.includes('*') || !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new DevConfigError('Set BETTER_AUTH_URL and any STENO_DEV_TRUSTED_ORIGINS to exact HTTP(S) origins without paths, credentials or wildcards.');
  }
  return url;
}

export const requiredTables = ['_prisma_migrations', 'user', 'account', 'session', 'StudentProfile',
  'Dictation', 'TypingAttempt', 'DictationReference', 'LoginAttempt', 'AbuseBucket'];

export function checkLedger(expected, rows) {
  const completed = new Map();
  for (const row of rows) {
    if (row.rolled_back_at) continue;
    if (!row.finished_at) throw new DevConfigError('The verification database has an unfinished migration. Inspect the Prisma migration ledger.');
    completed.set(row.migration_name, row.checksum);
  }
  if (completed.size !== expected.size || [...expected].some(([name, checksum]) => completed.get(name) !== checksum)) {
    throw new DevConfigError('Verification schema has pending, unknown or mismatched migrations. Compare the clone ledger and local migration checksums before starting.');
  }
}
