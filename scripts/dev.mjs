import { readFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { Client } from 'pg';
import { DevConfigError, checkDevConfig, checkLedger, requiredTables, verificationHost } from './dev-config.mjs';
import { loadEnvironment } from './load-environment.mjs';

async function main() {
  if (process.argv.length > 2) throw new DevConfigError('Configure host and port in .env.local, then run pnpm dev without arguments.');
  let local;
  try { local = parseEnv(readFileSync('.env.local', 'utf8')); }
  catch { throw new DevConfigError('Create .env.local from .env.example and provide disposable verification credentials.'); }
  const { database, port, bind, origins } = checkDevConfig(local, process.env);
  process.env.NODE_ENV = 'development';
  loadEnvironment(true);
  for (const key of ['DATABASE_URL', 'BETTER_AUTH_URL', 'BETTER_AUTH_SECRET', 'STENO_DEV_PORT', 'STENO_DEV_BIND', 'STENO_DEV_TRUSTED_ORIGINS']) {
    if (process.env[key] !== local[key]) throw new DevConfigError(`Keep ${key} in .env.local only for pnpm dev. Check mode-specific dotenv files and shell exports.`);
  }
  // Keep the probe on the pinned host. Do not forward connection options
  // from dotenv, and let Node verify the public TLS certificate and host.
  const client = new Client({
    host: verificationHost, port: 5432, database: decodeURIComponent(database.pathname.slice(1)),
    user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
    ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 5000, query_timeout: 5000,
  });
  try {
    try { await client.connect(); }
    catch { throw new DevConfigError('Could not connect securely to the disposable database. Check its credentials, network and Neon branch status.'); }
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
    const present = new Set(tables.rows.map(row => row.tablename));
    const missing = requiredTables.filter(table => !present.has(table));
    if (missing.length) throw new DevConfigError(`Verification database is missing tables: ${missing.join(', ')}. Check the branch and migration status.`);
    const expected = new Map(readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(({ name }) => [name, createHash('sha256').update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex')]));
    let ledger;
    try { ledger = await client.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"'); }
    catch { throw new DevConfigError('Could not read the verification migration ledger. Check the runtime role grants.'); }
    checkLedger(expected, ledger.rows);
    const compatibility = await client.query(`
      SELECT
        (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public'
          AND ((table_name = 'AbuseBucket' AND column_name IN ('key', 'count', 'resetAt'))
            OR (table_name = 'TypingAttempt' AND column_name IN ('submissionKey', 'referenceDigest', 'scoreVersion')))) AS columns,
        EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgname = 'replace_user_session_before_insert'
            AND tgrelid = 'public.session'::regclass AND tgenabled IN ('O', 'A')) AS session_trigger
    `);
    if (compatibility.rows[0]?.columns !== 6 || !compatibility.rows[0]?.session_trigger) {
      throw new DevConfigError('Verification schema drift detected: check attempt and rate-limit columns and the enabled session trigger.');
    }
  } finally {
    await client.end().catch(() => undefined);
  }
  console.log(`Development preflight passed: ${verificationHost}, port ${port}, origins ${origins.map(url => url.origin).join(', ')}.`);
  const require = createRequire(import.meta.url);
  process.env.STENO_DEV_PREFLIGHT = verificationHost;
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--port', String(port), '--hostname', bind], { stdio: 'inherit' });
  child.on('exit', code => { process.exitCode = code ?? 0; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}

main().catch(error => {
  // Only authored errors are safe to print. Drivers and Node errors can
  // carry query text, filesystem details or connection metadata.
  console.error(error instanceof DevConfigError ? error.message : 'Development preflight failed. Check local environment and database configuration.');
  process.exitCode = 1;
});
