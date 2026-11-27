# Database verification on the existing Neon clone

## Completed verification record

The owner reported all seven migrations applied with matching checksums,
zero Prisma drift, 16 passing integrity checks, eight matching data
fingerprints and preserved legacy archival. Atomic session replacement,
concurrency, failed insertion rollback, shared quota and cleanup passed.
The synthetic fixture test was intentionally skipped. All 21 targeted
tests, the Turbopack production build, all three HTTP checks, both
real-browser checks and the live 80% capacity test passed.

Clone size was 8,768 KiB before and 8,856 KiB after. The 2,000-attempt
workload used mean typed text of 309 bytes and a 276-byte reference,
measuring 1,761,280 bytes copied versus 1,400,832 bytes shared, or
20.47% less. Three small-clone SQL times were 0.113 ms (admin recent),
0.055 ms (student history) and 0.039 ms (published catalog).
Production quota usage, restore, TLS, and app latency remain separate
gates. Do not rerun pre-migration steps on the migrated branch.
See [the production release runbook](production-database-release.md).

Use the populated **stenotype-verification** branch. Its reported baseline is
PostgreSQL 18.7, 8768 kB, 3 dictations, 1 valid and 1 null-relation attempt,
94 login events, 1 profile, 2 users, 1 session and 2 credential accounts.
The existing 28 KiB private backup is operator-reported. Keep app traffic
off the clone until the preservation comparison completes.

## 1. Confirm the direct endpoint and verify the backup

Run in the existing fish terminal. Copy the direct host independently from
the Neon console with the **stenotype-verification** branch selected. An
endpoint hostname alone cannot prove branch identity.

```fish
cd (git rev-parse --show-toplevel)
read -P 'Direct hostname shown for stenotype-verification: ' STENO_BRANCH_HOST
set -gx STENO_BRANCH_HOST "$STENO_BRANCH_HOST"
set -gx STENO_BRANCH_URL "$STENO_BRANCH_URL"
set -gx DATABASE_URL "$DATABASE_URL"
set -gx STENO_INTEGRATION_DATABASE_URL "$STENO_INTEGRATION_DATABASE_URL"
set -gx STENO_DISPOSABLE_DB YES
node -e 'const a=process.env;const u=new URL(a.STENO_BRANCH_URL);if(u.hostname!==a.STENO_BRANCH_HOST||!u.hostname.endsWith(".neon.tech")||u.hostname.includes("-pooler")||a.DATABASE_URL!==a.STENO_BRANCH_URL||a.STENO_INTEGRATION_DATABASE_URL!==a.STENO_BRANCH_URL) process.exit(1);console.log("PASS: all URLs match the confirmed direct host",u.hostname)'
```

Expected: PASS for the clone. **Stop** for a mismatch, unknown branch, or
production host. If the variables are missing, return to the terminal
where they were configured. Do not copy them from a project environment
file. Never share URLs, cookies or passwords in test output.

```fish
read -P 'Path to your existing private backup: ' STENO_BACKUP_FILE
test -s "$STENO_BACKUP_FILE"
and stat -c '%a %s' "$STENO_BACKUP_FILE"
and pg_restore --list "$STENO_BACKUP_FILE" | head -12
set -gx STENO_VERIFY_DIR (mktemp -d)
chmod 700 "$STENO_VERIFY_DIR"
```

Expected: private mode, nonzero bytes, readable archive. **Stop** if the
backup cannot be verified. If it has become stale, create and inspect a
new one using the confirmed clone connection:

```fish
pg_dump --dbname="$STENO_BRANCH_URL" --format=custom --file="$STENO_VERIFY_DIR/clone-before.dump"
and chmod 600 "$STENO_VERIFY_DIR/clone-before.dump"
and pg_restore --list "$STENO_VERIFY_DIR/clone-before.dump" | head -12
```

## 2. Check checksums, baseline, and read compatibility

```fish
node scripts/db/verify-branch.mjs > "$STENO_VERIFY_DIR/before.txt"
and cat "$STENO_VERIFY_DIR/before.txt"
and psql "$STENO_BRANCH_URL" -X -v ON_ERROR_STOP=1 -f scripts/db/storage.sql > "$STENO_VERIFY_DIR/storage-before.txt"
and pnpm exec prisma generate
and node --import tsx scripts/db/check-cloned-legacy-read.ts
```

Expected: **3 applied checksums match**, baseline fingerprints with counts
2 users, 2 credential rows, 1 profile, 3 dictations, 94 login events,
1 session, 1 valid attempt and 1 legacy attempt, and a PASS for the actual Prisma
required-relation read against the legacy schema. **Stop** on a mismatch,
unfinished migration, or unexpected rows. The fingerprints stay private.

`pnpm exec prisma migrate status` before deployment should show the three
known applied entries and four pending ones, including the new shared-
reference migration. Prisma may exit 1 while pending migrations exist.
There is no baseline initialization, fixture seeding, ledger repair,
`db push`, or `migrate dev` in this procedure.

## 3. Apply pending migrations to the clone and prove preservation

```fish
pnpm exec prisma migrate deploy
and pnpm exec prisma migrate status
and pnpm exec prisma generate
and pnpm run db:check-sync
and pnpm run db:verify
and node scripts/db/verify-branch.mjs --after > "$STENO_VERIFY_DIR/after.txt"
and diff -u "$STENO_VERIFY_DIR/before.txt" "$STENO_VERIFY_DIR/after.txt"
```

Expected: four successful migrations, seven matching checksums, up-to-date
status, no Prisma schema drift and all DB integrity checks passing. The
last diff should show **only** the checksum-count line changing from 3 to
7. Its exit **1** is expected for that one-line difference. Run this
separate assertion to confirm the data fingerprints did not change:

```fish
tail -n 1 "$STENO_VERIFY_DIR/before.txt" > "$STENO_VERIFY_DIR/before-data.json"
tail -n 1 "$STENO_VERIFY_DIR/after.txt" > "$STENO_VERIFY_DIR/after-data.json"
cmp "$STENO_VERIFY_DIR/before-data.json" "$STENO_VERIFY_DIR/after-data.json"
and psql "$STENO_BRANCH_URL" -X -v ON_ERROR_STOP=1 -f scripts/db/storage.sql > "$STENO_VERIFY_DIR/storage-after.txt"
```

Expected: **cmp exit 0**. The valid row is compared without the removed
legacy columns and new empty metadata. The archived row is compared in
full. User, account, profile, session, dictation and login-history fingerprints
must match. **Stop** on migration or integrity failure. Collect the
failing migration name and redacted SQL error. Do not resolve it as
applied manually.

All four pending files have explicit transactions. The legacy migration
retains the null-dictation row in its archive and drops superseded
character counters on active rows. The submission migration adds
nullable columns and a per-student unique key. The session migration
may revoke redundant preexisting sessions. The shared-reference
migration moves any existing snapshots to content-addressed rows. A
historical attempt without a snapshot remains unassigned.

## 4. Test concurrent sessions, quota and cleanup

Run before starting the local app. Leave login retention disabled.
The second test in the existing database suite is for the original
synthetic CI fixture and remains skipped on this clone. The fingerprint
comparison above replaces it.

```fish
set -e STENO_EXPECT_LEGACY_FIXTURE
node --import tsx --test tests/db-integration.test.mjs
```

Expected: **1 pass, 1 skip**. The active test creates an isolated
temporary test user, competes for sessions and quota on concurrent
connections, tests failed replacement rollback, and exercises expired
row cleanup with login deletion off. It deletes its synthetic user on
exit. Operational cleanup also removes expired sessions and counters
already on the disposable branch. **Stop** if the active test skips or
fails.

## 5. Test concurrent submissions and capacity

In terminal A, use the confirmed clone URL and set a new local signing
secret. Use existing clone credentials for HTTP tests. No seeding is needed.

```fish
set -gx NEXT_TELEMETRY_DISABLED 1
set -gx BETTER_AUTH_URL http://localhost:3000
set -gx BETTER_AUTH_SECRET (openssl rand -hex 32)
set -gx DB_LOGIN_RETENTION_DAYS 0
set -gx DB_PROJECT_USAGE_PERCENT 0
pnpm run build
and pnpm run start
```

Expected: a production route table and a server on port 3000. For
sandbox build diagnosis on your machine, use `pnpm exec tsc --showConfig
--project tsconfig.json --pretty false` and `pnpm exec next build --webpack`
under the same confirmed clone environment if the normal build fails.

In terminal B:

```fish
cd (git rev-parse --show-toplevel)
read -P 'Existing clone admin email: ' ADMIN_EMAIL
read -s -P 'Existing clone admin password: ' ADMIN_PASSWORD
read -P 'Existing clone student email: ' SMOKE_EMAIL
read -s -P 'Existing clone student password: ' SMOKE_PASSWORD
set -gx ADMIN_EMAIL "$ADMIN_EMAIL"
set -gx ADMIN_PASSWORD "$ADMIN_PASSWORD"
set -gx SMOKE_EMAIL "$SMOKE_EMAIL"
set -gx SMOKE_PASSWORD "$SMOKE_PASSWORD"
set -gx SMOKE_BASE_URL http://localhost:3000
set -gx STENO_E2E_URL http://localhost:3000
set -gx CHROME_BIN (command -v chromium; or command -v google-chrome)
node --import tsx --test tests/auth-http.test.mjs
and node --import tsx --test tests/typing-ui-browser.test.mjs
```

Expected: **3 HTTP and 8 browser passes**, no skips. The HTTP suite adds
test records to the clone and exercises concurrent same-key submission,
historical transcript replay after editing, and session replacement and
logout. Run it after preservation checks. Stop for a disabled account or
incorrect credentials rather than resetting production credentials.

Stop terminal A's server with Ctrl-C, then restart it from that same
terminal under the controlled capacity override:

```fish
set -gx DB_PROJECT_USAGE_PERCENT 80
pnpm run start
```

From terminal B:

```fish
set -gx STENO_CAPACITY_TEST_URL http://localhost:3000
node --import tsx --test tests/db-capacity-http.test.mjs
```

Expected: **1 pass**, sign-in and sign-out HTTP 200, draft creation HTTP
503 with an explicit unsaved message. Stop the server and unset the
simulated provider floor with `set -e DB_PROJECT_USAGE_PERCENT` in
terminal A. Unit tests cover exact 50%, 70% and 80% boundaries. On a clone,
restart at 50 or 70 to see the matching admin warning. A cached sample is
per process and permits overshoot under concurrent writes.

## 6. Measure storage and query plans

From terminal A with the confirmed URL:

```fish
cat "$STENO_VERIFY_DIR/storage-before.txt" "$STENO_VERIFY_DIR/storage-after.txt"
psql "$STENO_BRANCH_URL" -X -v ON_ERROR_STOP=1 -f scripts/db/storage-workload.sql
and psql "$STENO_BRANCH_URL" -X -v ON_ERROR_STOP=1 -f scripts/db/explain-read-paths.sql
```

Expected: relation/heap/index/TOAST bytes, 2,000 attempts in the
session-local workload, copied versus shared total bytes, then three
read-only plans. The storage workload rolls back its temporary tables.
It models 100 students using one reference with varied input suffixes.
Repeat using representative passages and traffic before treating the
ratio as typical. Tiny clones often favor sequential scans. Inspect
estimated/actual rows, sorts, heap fetches and buffers before adding an
index. SQL database size is a local signal. Compare with Neon Console
project storage, other branches, compute and public egress.

## 7. Prepare a future release

First collect the migration/checksum summaries, preservation verdict,
database/HTTP test totals, capacity result, storage comparison and query
plans. Do not share backup contents, URLs, passwords, cookies or raw
student data. Keep the backup and confirm restore into an independently
approved disposable recovery target if rollback is needed. Use
`pg_restore --exit-on-error --dbname="$STENO_RECOVERY_URL"
"$STENO_BACKUP_FILE"` only after verifying that the recovery target is
an empty disposable database. Verify restored fingerprints before using
the copy.

For future production approval, review the production migration ledger
and provider headroom, choose a maintenance window and pause old writers,
take a verified backup, and rehearse on a fresh clone. Deploy the
database changes and matching app together during that window. Old app
versions can still write legacy snapshots after the new revision
migration and old readers cannot replay rows whose snapshots were
cleared. Rollback should use the reviewed backup or a compatible forward
fix, with a policy for any writes after the backup. No production command
is authorized by this runbook.
