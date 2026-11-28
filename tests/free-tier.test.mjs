import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/*
 * Free-tier guardrails.
 *
 * The project must stay inside Neon Free + Vercel Hobby. These tests fail
 * if a paid service, a cron job, image optimisation, an oversized pool or
 * an accidental dynamic home page is introduced.
 */

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const nextConfig = fs.readFileSync('next.config.ts', 'utf8');

const PAID_SDKS = [
  '@vercel/kv',
  '@vercel/blob',
  '@vercel/postgres',
  '@vercel/edge-config',
  '@vercel/analytics',
  '@vercel/speed-insights',
  '@neondatabase/serverless',
];

test('no paid storage/analytics SDKs are installed', () => {
  for (const dep of PAID_SDKS) {
    assert.equal(allDeps[dep], undefined, `${dep} would add a billable service`);
  }
});

test('image optimisation stays disabled (no image billing)', () => {
  assert.match(nextConfig, /unoptimized:\s*true/);
});

test('no cron / scheduled jobs', () => {
  assert.equal(fs.existsSync('vercel.json'), false);
  assert.doesNotMatch(nextConfig, /crons/);
});

test('the database pool stays small so Neon can suspend', () => {
  const source = fs.readFileSync('lib/db-config.ts', 'utf8');
  const match = source.match(/max:\s*(\d+)/);
  assert.ok(match, 'pool size not found');
  const max = Number(match[1]);
  assert.ok(max > 0 && max <= 10, `pool max ${max} is too large for the free tier`);
});

test('public practice and about are not forced dynamic', () => {
  for (const path of [
    'app/(public)/page.tsx',
    'app/(public)/about/page.tsx',
  ]) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /force-dynamic/, path);
  }
});

test('the home page stays free of server data work', () => {
  const source = fs.readFileSync('app/(public)/page.tsx', 'utf8');
  assert.doesNotMatch(source, /getSession|prisma|@\/lib\/db/);
});
