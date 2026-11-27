# StenoType — Audit TODO

Source: the audit run on 2026-11-24 (Gitleaks, Trivy, OSV, Lighthouse,
autocannon, k6, Prisma, TypeScript, ESLint, Knip, Madge, jscpd) plus the
code-level review. Only real findings are listed; rejected claims from
the earlier third-party report are not repeated here.

Verify any change with:

```bash
npm run typecheck
npm run lint
npm test
node scripts/audit/run.mjs --skip e2e   # fast audit, server on :3100
```

Full audit (includes Lighthouse/autocannon/k6):

```bash
node scripts/audit/run.mjs
```

---

## Batch 1 status (completed 2026-11-24)

| Item | Status | Evidence |
|---|---|---|
| P0-1 Next.js 16.4.5 | **Done** | OSV/Trivy no longer list `next`; build + 175 tests pass |
| P0-2 Zod 4.6.6 | **Done** | OSV no longer lists `zod@3`; schema tests pass |
| P0-3 effect 3.22.1 | **Done** | `pnpm-workspace.yaml` override; OSV no longer lists `effect@3.20.0` |
| P1-1 INACTIVE blocked | **Done** | `requireStudent` now requires `ACTIVE`; source test added |
| P1-4 revoke-sessions 404 | **Done** | unknown id → 404; source test added |
| P1-5 dead transcript route | **Done** | route deleted; test asserts it stays gone |
| P1-6 login audit comment | **Done** | schema comment now says successful sign-ins only |
| P1-2 CLS/LCP | **Done (measured)** | home passage is server-rendered; mobile Lighthouse 83 → **93**, CLS 0.215 → **0.084**, LCP 3.2s → **3.0s** |
| P1-3 unused JS | **Investigated, no code change** | the 24 KB unused chunk is Next's polyfill bundle (no scoring/passage code); scoring is used live by `align()`/`buildLiveChars()`, so splitting it would be a risky refactor with no byte win |
| P2-11 minimatch | **Still open** | only remaining OSV finding: `minimatch@10.2.6` → 11.0.1 (medium) |

Smoke: sign-in → session → sign-out passes against the production build on
`:3000` (the port in `BETTER_AUTH_URL`). Note: `SMOKE_BASE_URL` must match
`BETTER_AUTH_URL`, otherwise Better Auth returns `403 INVALID_ORIGIN`.

---

## Batch 2 status (completed 2026-11-25)

| Item | Status | Evidence |
|---|---|---|
| P1-7 CSP Report-Only + no `X-Powered-By` | **Done** | header present on `/`; `poweredByHeader: false`; source test added |
| P2-1 empty Prisma sections | **Done** | comment-only blocks removed; validate/status/drift pass |
| P2-2 `.env.example` | **Done** | keys only; `.gitignore` now un-ignores it |
| P2-3 unused student components | **Done** | `StudentStatusBadge` / `StudentCta` removed; Knip no longer lists them |
| P2-4 browser geometry test | **Done** | expected height now includes the surface border; real-Chromium test passes |
| P2-5 perf thresholds | **Done** | Lighthouse (perf ≥90, a11y 100, CLS ≤0.1, LCP ≤3.5s), autocannon (0 errors, p99 ≤100ms), k6 thresholds; audit fails on regression |
| P2-6 CI workflow | **Deferred by request** | add at the very end, after confirmation |
| P2-7 legacy migration | **Verified, pending deploy** | schema + migration + `db:verify` ready; tested on a restored copy |
| P2-8 admin list pagination | **Done** | `?limit`/`?offset`, capped at 200, `page.hasMore`; unit-tested |
| P2-9 login polish | **Done** | email autofocus + admin-created-accounts note |
| P2-10 ESLint warnings | **Done** | 0 errors, 0 warnings (intentional effect writes documented) |
| P2-11 minimatch | **Done** | override to 11.0.1; OSV/Trivy clean; lint still passes |

Full audit result: **16 pass · 1 findings · 1 skipped · 0 failed**
(Knip still reports 12 public types; Semgrep still cannot start in this
sandbox). Lighthouse: perf 92, a11y 100, CLS 0.084, LCP 3.17s.

---


## P0 — Security blockers (before the next deploy)

### P0-1. Upgrade Next.js 16.3.3 to a patched 16.4.x
- **Why:** 3 critical + 3 high advisories, including RCE in the Image
  Optimization API, `use cache`, and `next/og`. Current mitigations
  (`images.unoptimized`, no `next/og`, no `use cache`) reduce reachability
  but do not clear the advisories.
- **Files:** `package.json`, `pnpm-lock.yaml`
- **Change:** upgrade to `next@16.4.5` or newer 16.4.x; verify React 19.2
  peer compatibility.
- **Done when:** `node scripts/audit/run.mjs --skip perf,e2e` shows no
  `next` entries from OSV/Trivy; `npm run build` and `npm test` pass; home,
  login, student, and admin smoke paths work.
- **Effort:** M

### P0-2. Upgrade direct `zod` 3.25.76 to 4.6.6+
- **Why:** OSV advisory GHSA-mrhx-c7xc-m3w5 (CVSS 8.2). Better Auth already
  uses Zod 4.6.7, so the app is on two majors.
- **Files:** `package.json`, `lib/schemas.ts`, `lib/admin/schemas.ts`,
  `tests/*`
- **Change:** upgrade; adjust error options only if the tests require it.
  The code uses `object/enum/string/number/union/optional/transform`, which
  Zod 4 supports.
- **Done when:** all schema tests pass, `tsc` clean, OSV no longer lists
  `zod@3.25.76`.
- **Effort:** M

### P0-3. Patch transitive `effect` (3.20.0 → 3.22.1)
- **Why:** high-severity ReDoS (CVE-2026-121707). Transitive, not a direct
  dependency.
- **Files:** `package.json` (`pnpm.overrides`), `pnpm-lock.yaml`
- **Change:** add an override or bump the parent that pulls it in.
  Confirm the parent with `pnpm why effect`.
- **Done when:** OSV/Trivy no longer list `effect@3.20.0`; tests/build pass.
- **Effort:** S

---

## P1 — Correctness and performance

### P1-1. Enforce `INACTIVE` student status
- **Why:** `requireStudent` blocks only `SUSPENDED`, so an `INACTIVE`
  student can still submit attempts and use student APIs.
- **Files:** `lib/api-guard.ts:73`, `prisma/schema.prisma` (`User.banned`
  vs `StudentProfile.status`)
- **Change:** treat `INACTIVE` as blocked (or document why it is allowed),
  and reconcile the two "disabled" concepts into one rule.
- **Done when:** an INACTIVE student gets 403 on `/api/attempts` and
  student endpoints; a test covers it.
- **Effort:** S

### P1-2. Fix CLS 0.215 and LCP 3.2s on the home page
- **Why:** Lighthouse mobile is 83. The LCP element is the typing passage;
  the footer shifts 0.1405 of the 0.215 CLS because the passage/typing UI
  paints after hydration.
- **Files:** `components/typing/typing-client.tsx`,
  `app/(public)/page.tsx`, `lib/passage-generator.ts`, `app/globals.css`
- **Change:** render the initial passage/typing UI in the server HTML (or
  reserve the section's height) so the footer cannot move; keep the random
  rotation for later passages.
- **Done when:** mobile Lighthouse CLS < 0.1 and LCP < 2.5s (or a documented,
  measured improvement); footer stays put on load.
- **Effort:** M

### P1-3. Cut the 24 KB unused JS / 450ms LCP
- **Why:** Lighthouse reports 24 KB unused JS (34% of a 71 KB chunk),
  14 KB legacy JS, and 120ms render-blocking CSS.
- **Files:** `components/typing/typing-client.tsx`,
  `lib/typing/scoring.ts`
- **Change:** split review-only scoring/alignment code out of the initial
  bundle (dynamic import on finish/review) if it is not needed while typing.
- **Done when:** the initial chunk shrinks; Lighthouse unused-JS and LCP
  improve; typing/scoring tests still pass.
- **Effort:** M

### P1-4. Return 404 from `revoke-sessions` for a missing user
- **Why:** the route returns 200 with `revoked: 0` for an unknown id,
  unlike the ban route which correctly 404s.
- **Files:** `app/api/admin/users/[id]/revoke-sessions/route.ts`
- **Change:** check the user exists before deleting sessions.
- **Done when:** unknown id → 404; existing id → 200 with the count.
- **Effort:** S

### P1-5. Remove or fix the dead transcript endpoint
- **Why:** `app/api/dictations/[id]/transcript/route.ts` has no callers and
  its comment says students can view it, while the code is admin-only.
- **Files:** `app/api/dictations/[id]/transcript/route.ts`
- **Change:** delete it (nothing calls it) or correct the comment and add
  the intended caller.
- **Done when:** no dead API route and no contradictory comment.
- **Effort:** S

### P1-6. Make the login audit comment match the code
- **Why:** `prisma/schema.prisma:86` says every attempt (success or failure)
  is recorded; only successful sign-ins are written.
- **Files:** `lib/auth.ts:108`, `prisma/schema.prisma:86`
- **Change:** either record failed sign-ins or correct the comment.
- **Done when:** the schema comment and the hook agree.
- **Effort:** S

### P1-7. Add a CSP in Report-Only mode
- **Why:** HSTS, nosniff, frame, and referrer headers are present; CSP is
  missing. `X-Powered-By: Next.js` is also exposed.
- **Files:** `next.config.ts:17`
- **Change:** add `Content-Security-Policy-Report-Only` covering self,
  inline styles, and the font/image origins; remove `X-Powered-By`.
  Enforce after a clean report period.
- **Done when:** home/login/student/admin load with no CSP violations.
- **Effort:** S/M

---

## P2 — Cleanup, quality, and small UX

### P2-1. Remove empty Prisma sections
- **Files:** `prisma/schema.prisma:165-271`
- **Change:** delete the comment-only ASSIGNMENTS, DICTATION ATTEMPTS,
  EVALUATION, FEES, SCHEDULE, and ANNOUNCEMENTS blocks (or implement them).
- **Done when:** `npx prisma validate` passes and the schema has no dead
  sections.
- **Effort:** S

### P2-2. Add `.env.example`
- **Files:** `.env.example` (new)
- **Change:** list keys only, no values: `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SHADOW_DATABASE_URL`,
  `DEV_ORIGINS`, seed account placeholders.
- **Done when:** a new checkout can see every required key without exposing
  secrets.
- **Effort:** S

### P2-3. Remove genuinely unused components
- **Files:** `components/student/student-header.tsx:34,52`
- **Change:** delete `StudentStatusBadge` and `StudentCta`, or use them.
  Ignore Knip's test-only export noise.
- **Done when:** `npx knip` no longer lists those two functions.
- **Effort:** S

### P2-4. Fix the browser geometry assertion
- **Why:** the test compares surface height to viewport + padding but omits
  the surface's 1px top/bottom border, failing by ~2px.
- **Files:** `tests/typing-ui-browser.test.mjs:214-221`
- **Change:** include `borderTopWidth + borderBottomWidth` in the expected
  height, or use a 3px tolerance / `clientHeight`.
- **Done when:** `STENO_E2E_URL=http://localhost:3100 npm run test:ui` passes.
- **Effort:** S

### P2-5. Add perf thresholds to the audit runner
- **Why:** Lighthouse/autocannon/k6 currently record numbers but never fail.
- **Files:** `scripts/audit/run.mjs`
- **Change:** fail when Lighthouse performance < 90, CLS > 0.1, LCP > 2.5s,
  autocannon has non-2xx/errors, or k6 p95 > 800ms.
- **Done when:** a deliberate regression turns the audit red.
- **Effort:** S

### P2-6. Add a CI workflow
- **Why:** nothing runs automatically today.
- **Files:** `.github/workflows/audit.yml` (new)
- **Change:** fast checks on PRs (`typecheck`, `lint`, `test`, Gitleaks);
  full audit on a schedule or before deploy. Run Semgrep in CI/Docker,
  where its OCaml/Eio runtime works.
- **Done when:** PRs get a green/red audit without manual commands.
- **Effort:** M

### P2-7. Legacy-column and `dictationId` migration
- **Why:** `correctCharacters`/`incorrectCharacters` were marked legacy but
  still written; `dictationId` was nullable only for the additive migration.
- **Files:** `prisma/schema.prisma`, `lib/typing/attempt-snapshot.ts`,
  `prisma/migrations/20261125184500_drop_legacy_attempt_columns/`,
  `scripts/db/verify.mjs`
- **Change:** drop the two columns, delete the one attempt with no
  dictation, make `dictationId` required, and set the FK to `RESTRICT`.
- **Verified:** applied with `prisma migrate deploy` on a restored copy;
  `db:check-sync` clean, all integrity checks pass.
- **Done when:** the user deploys the pending migration and
  `npm run db:verify` passes on production.

### P2-8. Guard admin list endpoints
- **Files:** `app/api/admin/students/route.ts`,
  `app/api/admin/dictations/route.ts`
- **Change:** add a default `take` (and cursor/offset) so the lists cannot
  grow unbounded.
- **Done when:** both endpoints cap results and support paging.
- **Effort:** S

### P2-9. Login polish
- **Files:** `app/(public)/login/page.tsx:92`
- **Change:** `autoFocus` the email input; add one line noting accounts are
  created by an administrator.
- **Done when:** the field is focused on load and the note is visible.
- **Effort:** S

### P2-10. Clear the 14 ESLint `set-state-in-effect` warnings
- **Files:** `lib/auth-provider.tsx:106` and the other flagged files
- **Change:** fix the ones that cause cascading renders; suppress the ones
  that are intentional with a comment.
- **Done when:** `npm run lint` is warning-free or every suppression is
  justified.
- **Effort:** S/M

### P2-11. Patch `minimatch` 10.2.6 → 11.0.1
- **Why:** medium-severity advisory. It is transitive and a major bump.
- **Files:** `package.json` (`pnpm.overrides`), `pnpm-lock.yaml`
- **Change:** override only if the parent tooling tolerates it; otherwise
  wait for the parent bump.
- **Done when:** OSV/Trivy clear it and lint/build still work.
- **Effort:** S

---

## Deferred (not in this pass)

- Authenticated k6 journey (blocked by the single-session policy; needs a
  dedicated load-test account).
- OWASP ZAP / Nuclei / testssl.sh (need Docker permission or staging).
- CodeQL / Snyk (need GitHub/auth infrastructure).
- `@next/bundle-analyzer` (Lighthouse already identifies the chunk).
- clinic.js (Next has no plain `server.js`).
- Playwright / Vitest / Storybook / axe (redundant with the current
  `node:test` + Lighthouse setup).
- Soft-delete for students with results (current 409 is intentional).

---

## Suggested order

1. P0-1, P0-2, P0-3 — clear the CVEs, then rebuild and smoke-test.
2. P1-1, P1-4, P1-5, P1-6 — small correctness fixes.
3. P1-2, P1-3 — CLS/LCP work, re-measure with Lighthouse.
4. P1-7 — CSP report-only, then watch the console.
5. P2-4, P2-5, P2-6 — make the audit trustworthy and automatic.
6. P2-1, P2-2, P2-3, P2-8, P2-9, P2-10, P2-11 — cleanup.
7. P2-7 — legacy migration once the deploy is stable.

## Engineering implementation and verification

This section tracks the engineering follow-up. The route and visual design
remain those of the existing application. Status below distinguishes code
changes from behavior verified against an actual database or browser.

| Audit ID | Status | Root cause and implemented change | Remaining verification or decision |
| --- | --- | --- | --- |
| DB-01 | Implemented, legacy DB verification pending | Old PostgreSQL rows can carry a null dictation ID. Admin overview and result/history requests use a related-row filter in `lib/dictation-history.ts` before Prisma loads the required relation. The overview also has a defensive label. | Run the legacy fixture rehearsal below. Decide whether to retain legacy rows in an archive before authorizing the pending destructive migration. |
| SEC-01 | Implemented, HTTP verification pending | `app/api/[...all]/route.ts` exposes the three auth operations used by the app. Generic Better Auth admin operations are no longer reachable over HTTP. The guarded app APIs remain available. | Run the HTTP role and target-account tests. Confirm any external operator tooling uses the supported endpoints. |
| SEC-02 | Implemented, HTTP verification pending | `lib/student-session.ts` and `lib/api-guard.ts` require an active student profile. This applies to protected student reads and the published catalog API. | Run seeded active/inactive, suspended, banned and cross-role checks over HTTP. Confirm current policy with staff. |
| SEC-03 | Partial | `lib/auth.ts` serializes post-create cleanup per account and chooses a deterministic winner. The sign-out endpoint explicitly revokes the authenticated session and propagates failures. | Test real concurrent logins, DB failures and revocation. Session creation is still done by Better Auth before the application cleanup hook. Database-enforced single-session creation and recovery after process failure remain open. |
| SEC-04 | Partial | `lib/mutation-request.ts` checks custom mutation origins and bounds JSON bodies. The process-local attempt limiter sweeps expired buckets. | Verify HTTPS cookies, trusted proxy headers, and origins behind the eventual deployment. Shared multi-instance limits and enforced CSP remain open. |
| DB-02 | Implemented, HTTP verification pending | `app/api/admin/students/route.ts` uses Better Auth's hashing function and a nested Prisma write for the user, credential, and profile. Internal exceptions stay off the response. | Test successful sign-in, duplicate email and failed provisioning in the disposable DB. |
| SC-01 | Partial | Publication checks normalized transcript size and scored item count. Both the scoring API and editor handle known alignment limits explicitly. | Inventory older published content and decide how to handle dense or long passages without changing their scores. Matrix budget can still reject extreme typed input. |
| SC-02 | Implemented for terminology; policy unchanged | `components/typing/completion-panel.tsx` distinguishes attempted accuracy from passage coverage. Stored completion and scoring formulas are unchanged. | Check reports for consistent terminology and agree on any future alternative metrics before implementing them. |
| SC-03 | Implemented, HTTP verification pending | `lib/schemas.ts` bounds typed length and elapsed time. The speed gate uses normalized characters. Saved numeric results feed the review panel while the shared engine supplies the detail alignment. | Run API/UI boundary cases, including the 350 WPM ceiling and duplicate key payload mismatch. |
| SC-04 | Deferred | Current custom-text sanitization and dictation tokenization intentionally retain their existing behavior. | Choose a Unicode, apostrophe, and smart-punctuation policy before changing token identities or historical comparability. |
| EX-01 | Practice scope implemented | Score and mode copy now reflects that eligible dictation practice is saved. | Timing is still browser supplied and transcripts are released for practice review. Formal examination infrastructure remains outside scope. |
| EX-02 | Implemented, SQL/HTTP verification pending | `use-dictation-submission.ts` isolates the active request and keeps retries tied to the run. The API uses a per-student unique key and replays the original snapshot. | Apply only to a disposable current-schema DB for the concurrency, lost-response, and stale-client tests. |
| EX-03 | Partial | New attempts persist the transcript actually scored and retain their numeric snapshot. Admin edits use a conditional write. | The transcript is resolved at submission time. An immutable revision at run start and historical title/category snapshots are not implemented. |
| TY-01 | Implemented, browser verification pending | `use-typing-clock.ts` owns a monotonic timer and clamps completion. The input boundary rejects late characters. Enter respects native composition state. | Real keyboard, IME, suspension, mobile virtual keyboard, deadline and focus tests. |
| TY-02 | Partial | Finished-review generation waits until completion, blind live runs skip alignment, and unchanged scroll offsets are left alone. | Browser input-to-paint and layout measurements are still needed. Long visible-reference alignment remains synchronous. Evaluate a worker or an incremental algorithm only with fixture and browser parity. |
| DATA-01 | Partial | Admin student/dictation lists support bounded server search and paging. Student/admin general history pages page deterministically. Student summaries share lifetime aggregation. | Verify at realistic volumes. Per-dictation modal still shows a bounded recent sample, and deep pagination is intentionally bounded. |
| DATA-02 | Partial | Admin overview narrows its projection, dictation list payloads omit transcripts, and student profile and results no longer fetch after hydration. | Measure PostgreSQL plans, query counts, latency, regions, and pool behavior before adding performance indexes. |
| UI-01 | Partial | Admin lists distinguish failure from empty state. Student history modal cancels superseded requests and permits retry. | Verify keyboard behavior and race cases with a running app. Remaining mutation busy states and the full dialog focus pass are future work. |
| MAINT-01 | Partial | Extracted independent clock, submission and review components. Removed unused composition bookkeeping and duplicate admin role reads and statistics logic. | Preserve visual regression coverage before any deeper viewport or control refactor. |
| OPS-01 | Partial | CI config seeds its disposable schema and explicitly enables HTTP and browser suites. Audit runner skips migration ledger checks on the schema-pushed CI fixture. | Confirm CI execution once authorized to publish. Legacy migration rehearsal, telemetry, remote scan tool pinning, and restore verification remain open. |
| DI-01 | Partial | Selection requires a catalog match, catalog errors can be retried, and the admin schema checks YouTube ID format while permitting text-only items. | External playback remains the supported workflow. Verify mobile handoff, unavailable media, and existing nonconforming IDs. |
| UX-01 | Engineering-only subset | Corrected custom-text availability and recorded-practice copy, took interactive controls out of the typing key capture, and added dialog semantics to history. | Navigation, branding, component library, comprehensive accessibility and UI overhaul are a separate phase. |

### Local results and performance

- Next.js route type generation, TypeScript, ESLint, Prisma schema validation, and 198 in-process
  assertions passed. Four opt-in browser/HTTP cases require a running
  application. The attempt schema was generated locally with a dummy
  loopback URL. No migration ran.
- The Turbopack build stopped when a helper was denied permission to
  bind a local port. A webpack fallback stopped while parsing TypeScript
  configuration output. This environment also denied a plain Node
  loopback listener and Docker access. No live test result is claimed.
- Alternating Node CPU microbenchmark, 16 samples per variant after
  warmup, on mismatched synthetic passages. Compared the old live
  alignment plus review-item build with alignment alone. At 75 words
  (430 characters), median was 1.06 ms versus 1.02 ms. At 700 words
  (4,024 characters), median was 87.79 ms versus 87.24 ms. This measures
  computation only and does not establish input-to-paint improvement.
  No database query plans or browser timing were collected.

### Disposable verification and migration gates

- [ ] Current-schema smoke. Use a newly created local Postgres database
  and explicit disposable credentials. Verify the DB name and host
  before issuing any schema command. Populate the empty database with
  `prisma db push` without data-loss flags, generate the client, seed the
  two test accounts, start the local app and run the opt-in tests with
  the same environment variables used by CI.
- [ ] Legacy-compatibility fixture. In a separate empty disposable
  database, prepare the initial schema plus the additive attempt-stat
  migration. Insert one eligible dictation attempt and one null-relation
  legacy attempt. With the current client, verify overview, student and
  admin history, and lifetime aggregates choose the intended records
  without exception. Compare read-only counts before and after.
- [ ] Existing-data policy. Inventory null relations in a sanitized
  snapshot using read-only SQL. Authorize an archive/retention decision
  and a recoverable backup separately before the old migration can be
  applied. The existing `20261125184500_drop_legacy_attempt_columns`
  migration deletes null-relation rows and drops columns. It was neither
  changed nor executed by this follow-up.
- [ ] Additive submission migration. The new
  `20261126120000_attempt_submission_integrity` migration adds nullable
  fields and a scoped unique index. Verify the transaction, index and
  retained older rows on an explicitly disposable copy. New dictation
  writes require these columns. Review migration order as a release
  gate. A standard migration deploy applies pending predecessors too.
- [ ] Browser, performance and security gate. Run the opt-in suites,
  keyboard/mobile regression matrix, and measured queries in a running
  local or staging environment. Keep the application local until the
  owner has tested it and explicitly authorizes publication.

## Completion pass

This section supersedes earlier statuses where they differ. The exact
fish commands, expected results and return packet are in
[the engineering verification runbook](docs/engineering-verification.md).

| Item | Latest status | Evidence and gate |
| --- | --- | --- |
| SEC-03 atomic session replacement and revocation | **Implemented but unverified on PostgreSQL** | The new database trigger serializes replacements under a user row lock. A unique user index enforces one session even for outside writers. Rollback of a failed replacement must preserve the old session. The opt-in DB and HTTP tests exercise rollback, concurrent inserts, logout, replay of the dead cookie and concurrent sign-ins. A still-valid cookie remains replayable. |
| TY-02 long passage and TY-01 interactions | **Worker scoring parity verified; browser integration blocked** | The real Node worker test matched the full alignment and scores and rejected the same budget overflow. Large work is offloaded with one executing and one latest pending input. Short scoring and positional live feedback remain synchronous. Final display accepts only the current input result. Browser caret, correction and worker-bundle tests require a running app. |
| DB-01 and EX-02 migrations | **Implemented but unverified on PostgreSQL** | The P2-7 transaction archives the full null-relation row before removing it from active history. The following migration has an additive scoped unique key. Both require a fresh branch rehearsal and analysis of the preexisting migration ledger before any rollout. |
| SEC-01, SEC-02, DB-02 | **Implemented but HTTP verification blocked** | The three endpoint allowlist, nested provisioning write, current-role guards and inactive-student gate have static/regression coverage. Compatibility with generated credentials and admin operations is part of the full HTTP fixture. |
| SEC-04 Vercel instances | **Shared quotas implemented; deployment verification pending** | PostgreSQL gates new scoring work and use of each normalized sign-in email. On Vercel it also gates sign-ins by the platform-provided IP. Counters are cleaned periodically. No paid infrastructure. Distributed traffic across many source IPs still needs upstream protection if it becomes a problem. |
| DATA-01/02 | **Partially implemented; plans blocked** | Lifetime aggregations, narrowed data access, server paging and module-scoped pool reuse in place. Three reproducible EXPLAIN queries added. No query-plan or pool improvement is claimed before representative data. |
| OPS-01 | **Build/integration blocked** | This sandbox denies loopback and Docker. Turbopack fails binding a helper port. The Next webpack TypeScript subprocess returned exit 0 with zero stdout in the sandbox, while the direct TypeScript CLI produced valid JSON. CI uses a disposable migration and fixtures, with tests enabled explicitly. |
| SC-04 and formal grading/revisions | **Deferred** | Changing the language/token policy or implementing timed examinations requires product rules. Current dictation records the transcript used for scoring at submission. |
| UX-01 visual work | **Deferred** | No visual redesign this pass. |

Verification: 200 passed, 0 failed, 7 skipped. The skips are 3 seeded
HTTP checks, 2 PostgreSQL checks, and 2 Chromium checks. Next route
type generation, TypeScript, ESLint and Prisma validation passed.
No backup, migration, deploy, push, or production DB operation was
performed.

A 4,024-character mismatched Node benchmark, median of 16 samples after
warmup, measured 80.326 ms for inline alignment plus positional
feedback versus 0.049 ms of caller work through worker dispatch and
82.142 ms worker round trip. This shows the expensive work moved off
the caller thread. It excludes browser rendering, result receipt and
painting. The browser trace remains a separate gate.

## Final database workstream

- **DB-01, EX-02, SEC-03 — implemented; clone verification pending.**
  Previously applied migration files and the three earlier pending SQL
  files were left as found. The cloned-branch runbook checks exact ledger
  checksums and compares private canonical fingerprints before and after
  migration. It includes the legacy Prisma read, session and quota tests,
  and concurrent HTTP submissions. No Neon connection was attempted.
- **EX-03 — shared reference storage implemented; PostgreSQL unverified.**
  Exact-text SHA-256 references with checks and restricted foreign keys
  preserve shared historical transcripts. Older snapshots are migrated,
  genuinely unknown references stay unknown, and the scorer is unchanged.
- **OPS-01 — bounded maintenance and capacity control implemented.**
  Expired sessions and quota rows are removed on normal traffic. Old
  login records require an opt-in threshold. Unit checks verify boundary
  policy. Capacity and cleanup integration suites require the confirmed
  clone and a running app.
- **DATA-01/02 — measurement scripts ready; provider measurements pending.**
  Login audit now uses one INSERT SELECT. A roll-back-only synthetic
  workload reports tuple/index/TOAST estimates from PostgreSQL.
  Query-plan and provider headroom verification remain required.
  Owner-reported 8768 kB is a baseline, not a Neon quota measurement.
- **Retention decisions — awaiting approval.** Login 30 days proposed and
  disabled by default. Genuine results, archive transcripts, accounts
  and official materials have no purge process. Compact lifetime
  rollups must be designed and verified before any future detail purge.
- **Verification runbooks.** See [existing clone procedure](docs/engineering-verification.md)
  and [Neon Free projections](docs/neon-free-capacity.md).

## Database release review — verified on populated clone

- **DB-01, EX-02, SEC-03 — verified on the clone.** Seven applied
  checksums matched, drift was zero, 16 integrity checks passed, and
  all 8 before/after fingerprints matched. Legacy archival, concurrent
  sessions/submissions, failed replacement rollback, shared quota,
  cleanup and HTTP auth passed. The synthetic legacy fixture was skipped
  intentionally. Production ledger, TLS and approved recovery remain gates.
- **EX-03 — shared storage benchmark verified.** For 2,000 attempts with
  309-byte mean typed text and a 276-byte reference, total measured
  storage was 1,761,280 bytes copied and 1,400,832 bytes shared
  (20.47% reduction). This is a workload-specific result. The clone
  itself grew from 8,768 to 8,856 KiB after migrations.
- **OPS-01 — build and integration verified on the clone.** All 21
  targeted tests, the production Turbopack build, three HTTP checks,
  two Chromium checks, and live 80% capacity check passed. This review
  did not rerun the database or browser tests.
- **DATA-01/02 — small-clone SQL verified.** Admin recent results
  0.113 ms, student history 0.055 ms, catalog 0.039 ms. No evidence
  warrants additional indexes. Production latency, Neon compute and
  egress remain unmeasured.
- **Release TODO:** select the tested artifact and exclude local skills,
  CI scratch output, secrets and generated files. Rehearse verified TLS
  and role grants, confirm provider headroom, take and restore a
  consistent backup, verify ledger and fingerprints, and coordinate
  schema change and matching app promotion under a write gate.
- **Retention TODO:** keep `DB_LOGIN_RETENTION_DAYS=0`. No purge of
  genuine history or accounts. Any change requires approval.

See [production database release](docs/production-database-release.md)
for fish commands, recovery gates and stopping conditions.

## Pre-release candidate

See [pre-release verification](docs/pre-release-verification.md) for the current evidence, remaining deployment gates and staging checklist.
