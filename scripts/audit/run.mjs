#!/usr/bin/env node
/*
 * StenoType audit runner — one command, no redundant tools.
 *
 *   node scripts/audit/run.mjs
 *   node scripts/audit/run.mjs --url http://localhost:3100
 *   node scripts/audit/run.mjs --skip perf,e2e
 *
 * Tooling lives in node_modules/.audit-tools (gitignored). The required
 * source secret scan fails if the scanner is absent, skipped or fails.
 * Checks explicitly labeled report-only do not determine the exit code.
 */

import { spawnSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const toolsBin = path.join(root, 'node_modules/.audit-tools/bin');
const semgrep = path.join(
  root,
  'node_modules/.audit-tools/semgrep-venv/bin/semgrep'
);

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const url = arg('--url', process.env.AUDIT_URL || 'http://localhost:3100');
const skip = new Set((arg('--skip', '') || '').split(',').filter(Boolean));
const outDir = arg(
  '--out',
  path.join(root, 'node_modules/.audit-tools/reports')
);
const env = {
  ...process.env,
  PATH: `${toolsBin}:${process.env.PATH}`,
  AUDIT_URL: url,
  BASE_URL: url,
  CI: '1',
};

mkdirSync(outDir, { recursive: true });

const chromeFlags =
  '--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage';

/*
 * Regression gates. These are deliberately set at today's accepted
 * baseline, not at the ideal target, so a regression fails the audit
 * without failing on known debt. Tighten them as the debt is paid:
 *   LCP target 2500ms, CLS target 0.05, p99 target 50ms.
 */
const thresholds = {
  lighthouse: {
    performance: 90,
    accessibility: 100,
    'best-practices': 90,
    seo: 90,
  },
  lcpMs: 3500,
  cls: 0.1,
  autocannonP99Ms: 100,
};

const checks = [
  {
    id: 'secrets',
    group: 'security',
    label: 'Gitleaks (required source secret scan)',
    required: true,
    cmd: path.join(toolsBin, 'gitleaks'),
    args: [
      'dir',
      '.',
      '--config',
      'scripts/audit/gitleaks.toml',
      '--redact',
      '--no-banner',
    ],
    timeout: 120_000,
  },
  {
    id: 'deps-trivy',
    group: 'security',
    label: 'Trivy (deps + misconfig)',
    cmd: path.join(toolsBin, 'trivy'),
    args: [
      'fs',
      '-q',
      '--scanners',
      'vuln,misconfig,secret',
      '--skip-dirs',
      'node_modules',
      '--skip-dirs',
      '.next',
      '--skip-dirs',
      '.git',
      '--skip-files',
      '.env',
      '--skip-files',
      '.env.local',
      '--format',
      'table',
      '.',
    ],
    allowFailure: true,
    timeout: 300_000,
  },
  {
    id: 'deps-osv',
    group: 'security',
    label: 'OSV-Scanner (lockfile CVEs)',
    cmd: path.join(toolsBin, 'osv-scanner'),
    args: [
      'scan',
      'source',
      '--lockfile',
      'pnpm-lock.yaml',
      '--format',
      'table',
    ],
    allowFailure: true,
    timeout: 300_000,
  },
  {
    id: 'sast',
    group: 'security',
    label: 'Semgrep (static analysis)',
    cmd: semgrep,
    args: [
      'scan',
      '--config',
      'p/default',
      '--metrics',
      'off',
      '-j',
      '1',
      '--max-memory',
      '1500',
      '--exclude',
      'node_modules',
      '--exclude',
      '.next',
      '.',
    ],
    allowFailure: true,
    // This sandbox blocks semgrep-core's OCaml/Eio thread startup. That
    // is an environment limit, not a clean scan — say so explicitly.
    skipPattern: /engine was killed|Resource temporarily unavailable/,
    timeout: 420_000,
  },
  {
    id: 'headers',
    group: 'security',
    label: 'Security headers',
    custom: checkHeaders,
  },
  {
    id: 'typecheck',
    group: 'static',
    label: 'TypeScript',
    cmd: 'npm',
    args: ['run', 'typecheck'],
    timeout: 120_000,
  },
  {
    id: 'lint',
    group: 'static',
    label: 'ESLint',
    cmd: 'npm',
    args: ['run', 'lint'],
    timeout: 120_000,
  },
  {
    id: 'tests',
    group: 'static',
    label: 'Unit tests',
    cmd: 'npm',
    args: ['test'],
    timeout: 180_000,
  },
  {
    id: 'prisma-validate',
    group: 'database',
    label: 'Prisma validate',
    cmd: 'npx',
    args: ['prisma', 'validate'],
    timeout: 120_000,
  },
  {
    id: 'prisma-status',
    group: 'database',
    label: 'Prisma migration status',
    cmd: 'npx',
    args: ['prisma', 'migrate', 'status'],
    timeout: 120_000,
  },
  {
    id: 'prisma-drift',
    group: 'database',
    label: 'Prisma schema drift',
    cmd: 'npm',
    args: ['run', 'db:check-sync'],
    timeout: 120_000,
  },
  {
    id: 'unused',
    group: 'quality',
    label: 'Knip (unused files/exports)',
    cmd: 'npx',
    args: ['--yes', 'knip', '--no-progress'],
    allowFailure: true,
    timeout: 180_000,
  },
  {
    id: 'cycles',
    group: 'quality',
    label: 'Madge (circular imports)',
    cmd: 'npx',
    args: [
      '--yes',
      'madge',
      '--circular',
      '--extensions',
      'ts,tsx',
      '--exclude',
      '(node_modules|\\.next|generated)',
      '.',
    ],
    allowFailure: true,
    timeout: 120_000,
  },
  {
    id: 'dupes',
    group: 'quality',
    label: 'jscpd (duplicate code)',
    cmd: 'npx',
    args: [
      '--yes',
      'jscpd',
      '--min-tokens',
      '150',
      '--ignore',
      '**/node_modules/**,**/.next/**,**/tests/**,**/generated/**',
      '--reporters',
      'console',
      '.',
    ],
    allowFailure: true,
    timeout: 180_000,
  },
  {
    id: 'lighthouse',
    group: 'perf',
    label: 'Lighthouse (mobile)',
    cmd: 'npx',
    args: [
      '--yes',
      'lighthouse@latest',
      url,
      `--chrome-flags=${chromeFlags}`,
      '--output=json',
      `--output-path=${path.join(outDir, 'lighthouse.json')}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--quiet',
    ],
    validate: validateLighthouse,
    timeout: 240_000,
  },
  {
    id: 'autocannon',
    group: 'perf',
    label: 'Autocannon (HTTP throughput)',
    cmd: 'npx',
    args: ['--yes', 'autocannon', '-c', '50', '-d', '15', '-j', url],
    validate: validateAutocannon,
    timeout: 180_000,
  },
  {
    id: 'k6',
    group: 'perf',
    label: 'k6 (public journey)',
    cmd: path.join(toolsBin, 'k6'),
    args: ['run', 'scripts/audit/load.k6.js'],
    timeout: 180_000,
  },
  {
    id: 'e2e',
    group: 'e2e',
    label: 'Typing UI (real Chromium)',
    cmd: 'npm',
    args: ['run', 'test:ui'],
    env: { STENO_E2E_URL: url },
    timeout: 180_000,
  },
];

function tail(text, lines = 40) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function runCheck(check) {
  if (check.allowFailure) check = { ...check, label: check.label + ' (report-only)' };
  if (skip.has(check.group) || skip.has(check.id)) {
    return { ...check, status: 'skip', output: 'skipped by flag', ms: 0 };
  }

  if (check.custom) {
    const started = Date.now();
    return check
      .custom()
      .then((result) => ({ ...check, ...result, ms: Date.now() - started }))
      .catch((error) => ({
        ...check,
        status: 'error',
        output: String(error?.stack || error),
        ms: Date.now() - started,
      }));
  }

  if (check.cmd.includes('/') && !existsSync(check.cmd)) {
    return {
      ...check,
      status: check.allowFailure ? 'skip' : 'error',
      output: `not installed at ${check.cmd}`,
      ms: 0,
    };
  }

  const started = Date.now();
  const result = spawnSync(check.cmd, check.args, {
    cwd: root,
    env: { ...env, ...(check.env ?? {}) },
    encoding: 'utf8',
    timeout: check.timeout ?? 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  if (result.error) {
    return { ...check, status: 'error', output: String(result.error), ms };
  }

  if (check.skipPattern && check.skipPattern.test(output)) {
    return {
      ...check,
      status: 'skip',
      output: `tool cannot run in this environment\n${tail(output, 12)}`,
      ms,
    };
  }

  const status =
    result.status === 0 ? 'pass' : check.allowFailure ? 'findings' : 'fail';

  if (status === 'pass' && check.validate) {
    const verdict = check.validate(output);
    if (verdict) {
      return {
        ...check,
        status: verdict.status,
        output: `${output}\n${verdict.output}`,
        ms,
      };
    }
  }

  return { ...check, status, output, ms };
}

function validateLighthouse() {
  const file = path.join(outDir, 'lighthouse.json');
  if (!existsSync(file)) {
    return { status: 'fail', output: 'lighthouse.json was not written' };
  }

  try {
    const report = JSON.parse(readFileSync(file, 'utf8'));
    const categories = report.categories ?? {};
    const audits = report.audits ?? {};
    const scores = Object.fromEntries(
      Object.entries(categories).map(([name, value]) => [
        name,
        Math.round((value.score ?? 0) * 100),
      ])
    );
    const cls = audits['cumulative-layout-shift']?.numericValue ?? 0;
    const lcp = audits['largest-contentful-paint']?.numericValue ?? 0;
    const problems = [];

    for (const [name, minimum] of Object.entries(thresholds.lighthouse)) {
      const got = scores[name];
      if (typeof got === 'number' && got < minimum) {
        problems.push(`${name} ${got} < ${minimum}`);
      }
    }
    if (cls > thresholds.cls) {
      problems.push(`CLS ${cls.toFixed(3)} > ${thresholds.cls}`);
    }
    if (lcp > thresholds.lcpMs) {
      problems.push(`LCP ${Math.round(lcp)}ms > ${thresholds.lcpMs}ms`);
    }

    const summary =
      `perf ${scores.performance} · a11y ${scores.accessibility} · ` +
      `bp ${scores['best-practices']} · seo ${scores.seo} · ` +
      `CLS ${cls.toFixed(3)} · LCP ${Math.round(lcp)}ms`;

    return {
      status: problems.length > 0 ? 'fail' : 'pass',
      output: problems.length > 0
        ? `${summary}\nFAIL: ${problems.join('; ')}`
        : summary,
    };
  } catch (error) {
    return { status: 'fail', output: `cannot read lighthouse.json: ${error}` };
  }
}

function validateAutocannon(output) {
  const start = output.indexOf('{');
  if (start < 0) {
    return { status: 'fail', output: 'no JSON in autocannon output' };
  }

  try {
    const result = JSON.parse(output.slice(start));
    const p99 = result.latency?.p99 ?? 0;
    const problems = [];
    if ((result.errors ?? 0) > 0) problems.push(`${result.errors} errors`);
    if ((result.timeouts ?? 0) > 0) problems.push(`${result.timeouts} timeouts`);
    if ((result.non2xx ?? 0) > 0) problems.push(`${result.non2xx} non-2xx`);
    if (p99 > thresholds.autocannonP99Ms) {
      problems.push(`p99 ${p99}ms > ${thresholds.autocannonP99Ms}ms`);
    }

    const summary = `${Math.round(result.requests?.average ?? 0)} req/s · p99 ${p99}ms`;
    return {
      status: problems.length > 0 ? 'fail' : 'pass',
      output: problems.length > 0
        ? `${summary}\nFAIL: ${problems.join('; ')}`
        : summary,
    };
  } catch (error) {
    return { status: 'fail', output: `cannot parse autocannon JSON: ${error}` };
  }
}

async function checkHeaders() {
  const response = await fetch(url, { redirect: 'manual' });
  const required = [
    'x-content-type-options',
    'x-frame-options',
    'strict-transport-security',
    'referrer-policy',
    'content-security-policy-report-only',
  ];
  const present = required.filter((name) => response.headers.has(name));
  const missing = required.filter((name) => !response.headers.has(name));
  const csp = response.headers.get('content-security-policy-report-only');
  const poweredBy = response.headers.get('x-powered-by');

  const lines = [
    `status ${response.status}`,
    `present: ${present.join(', ') || 'none'}`,
    `missing: ${missing.join(', ') || 'none'}`,
    `content-security-policy-report-only: ${csp ?? 'MISSING'}`,
    `x-powered-by: ${poweredBy ?? 'absent'}`,
  ];

  return {
    status: missing.length === 0 && !poweredBy ? 'pass' : 'fail',
    output: lines.join('\n'),
  };
}

function fmt(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function summarizePerf(results) {
  const lighthouse = results.find((item) => item.id === 'lighthouse');
  if (!lighthouse) return [];

  const file = path.join(outDir, 'lighthouse.json');
  if (!existsSync(file)) return [];

  try {
    const report = JSON.parse(readFileSync(file, 'utf8'));
    const categories = report.categories ?? {};
    const audits = report.audits ?? {};
    const scores = Object.entries(categories).map(
      ([name, value]) => `${name} ${Math.round((value.score ?? 0) * 100)}`
    );
    const cls = audits['cumulative-layout-shift']?.displayValue;
    const lcp = audits['largest-contentful-paint']?.displayValue;
    const metrics = [cls && `CLS ${cls}`, lcp && `LCP ${lcp}`].filter(Boolean);
    return [...scores, ...metrics];
  } catch {
    return [];
  }
}

function render(results) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outDir, `audit-${stamp}.md`);
  const latestPath = path.join(outDir, 'audit-latest.md');

  const lines = [
    `# StenoType audit — ${new Date().toISOString()}`,
    '',
    `- URL: ${url}`,
    `- Node: ${process.version}`,
    `- Commit: ${gitCommit()}`,
    '',
    '## Summary',
    '',
    '| Check | Result | Time |',
    '| --- | --- | --- |',
    ...results.map(
      (item) => `| ${item.label} | ${item.status} | ${fmt(item.ms)} |`
    ),
    '',
  ];

  const perf = summarizePerf(results);
  if (perf.length > 0) {
    lines.push('## Lighthouse', '', `- ${perf.join(' · ')}`, '');
  }

  for (const item of results) {
    lines.push(`### ${item.label}`, '', `**${item.status}** · ${fmt(item.ms)}`, '');
    if (item.status !== 'skip') {
      lines.push('```text', tail(item.output, 60) || '(no output)', '```', '');
    }
  }

  const body = lines.join('\n');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(reportPath, body);
  writeFileSync(latestPath, body);
  return { reportPath, latestPath };
}

function gitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

const results = [];
for (const check of checks) {
  const result = await runCheck(check);
  results.push(result);
  const icon =
    result.status === 'pass'
      ? 'PASS'
      : result.status === 'findings'
        ? 'FIND'
        : result.status === 'skip'
          ? 'SKIP'
          : 'FAIL';
  console.log(`${icon.padEnd(5)} ${result.label} (${fmt(result.ms)})`);
  if (result.status === 'findings' || result.status === 'fail') {
    console.log(
      tail(result.output, 12)
        .split('\n')
        .map((line) => `      ${line}`)
        .join('\n')
    );
  }
}

const { reportPath, latestPath } = render(results);
const failed = results.filter(item => item.status === 'fail' || (item.status === 'error' && !item.allowFailure) || (item.required && item.status !== 'pass')).length;

console.log('');
console.log(`Report: ${reportPath}`);
console.log(`Latest: ${latestPath}`);
console.log(
  `${results.filter((item) => item.status === 'pass').length} pass · ` +
    `${results.filter((item) => item.status === 'findings').length} findings · ` +
    `${results.filter((item) => item.status === 'skip').length} skipped · ` +
    `${failed} failed`
);

process.exitCode = failed > 0 ? 1 : 0;
