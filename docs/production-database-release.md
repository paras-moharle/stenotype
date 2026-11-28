# Production database release

This runbook records the original seven-migration cutover. For the eighth migration and current retention policy, follow [Single saved dictation results](single-saved-result.md).
For the alternative endpoint-promotion approach, see the [promotion assessment](database-promotion-assessment.md). It requires separate approval and reconciliation before it replaces this runbook.


**Status: ready for a controlled cutover after the release gates below.**
No schema or scoring change is proposed by this review. The operator
successfully verified the populated Neon clone. Production connectivity,
rollback recovery, workload capacity and SSL configuration remain
environment-specific gates. This runbook requires separate authorization
for production access, migration and deployment.

## Verified on stenotype-verification

Operator-reported results:

- Seven migrations applied with matching checksums. Prisma reported zero
  drift. All 16 integrity checks and all eight data fingerprints passed.
  The legacy null-dictation result was archived and the valid result retained.
- Concurrent database sessions, atomic replacement, failed insertion
  rollback, shared quota and cleanup passed. The synthetic legacy fixture
  was intentionally skipped because the populated clone provided real data.
- All 21 targeted tests passed. The Turbopack production build, three HTTP
  tests, two real-browser tests and live 80% capacity HTTP check passed.
- Database size was 8,768 KiB before and 8,856 KiB after, an increase of
  88 KiB. The 2,000-attempt benchmark used 309-byte mean input and a
  276-byte reference. Copied references took 1,761,280 bytes and shared
  references took 1,400,832 bytes, saving 360,448 bytes (20.47%).
- Execution times on the small clone were 0.113 ms for admin recent
  results, 0.055 ms for student history and 0.039 ms for the published
  catalog. These are SQL execution times, excluding connection, cold
  start and application latency. They do not justify additional indexes.

The clone results are operator-supplied. No raw plan output, production
telemetry, pooled-endpoint TLS test, production recovery drill or
large-volume measurements were available in this review.

## Prepare the release artifact and secrets

Review the exact source and lockfile tested on the clone. Build the app
with the production runtime settings but keep its preview isolated from
production. Use an explicit release candidate and record the previous
app deployment ID. Disable automatic promotion until the database is
verified. The worktree includes existing public/UI and icon changes.
Select the intended release scope deliberately.

Exclude `.agents/`, `.claude/`, `.windsurf/` and `skills-lock.json` from
the release unless deliberately maintaining those development tools.
The Prisma guides and local symlinks
are development material. The application has no dependency on the
skill bundle. Exclude `.env`, dumps, generated Prisma output, and
Next/TypeScript build output. Keep `.env.example`, source scripts and
the four pending migrations. Re-run a redacted secret scanner on the
final candidate, including chosen untracked files. Keep rollback
artifacts outside the repo.

- Server runtime: `DATABASE_URL` contains the Neon pooled connection for
  the production branch. Use a scoped runtime role where practical.
  A separate direct migration role needs ownership/grants for DDL and
  trigger creation. Verify the runtime can execute the session trigger
  with its invoker privileges, including the user-row lock, and write
  attempts, counters and maintenance rows. Check role grants on new tables.
- Set `BETTER_AUTH_URL` to the canonical HTTPS origin and store a stable
  random `BETTER_AUTH_SECRET` in the deployment secret store. Keep the
  current valid secret when preserving existing signed cookies. A secret
  change requires a planned session invalidation. No seed credentials
  or verification toggles belong in production. Set
  `DB_LOGIN_RETENTION_DAYS=0`. Document any capacity overrides.
- Runtime Prisma uses node-postgres. Explicitly set
  `sslmode=verify-full` on the pooled URL and use the real Neon hostname
  and trusted CA. Use `sslrootcert` only when supplying a readable CA file
  to that driver. Do not disable Node certificate verification or rely
  on the URI's `channel_binding` to enforce it in node-postgres. Test TLS
  and the exact pooler URL on the approved disposable branch first.
- For `psql`, `pg_dump` and `pg_restore`, use the direct endpoint with
  `sslmode=verify-full&channel_binding=require` and a suitable system
  CA store (for example `sslrootcert=system` on supported libpq).
  Use PostgreSQL 18 client tools for the 18.7 server. For Prisma CLI,
  use a separate direct URL with Prisma-supported TLS options
  (`sslmode=require&sslaccept=strict`, with `sslcert` if needed). Prove the exact CLI configuration against the
  clone before using it on production. Do not assume Prisma CLI accepts
  libpq or pg-specific URL options. The current Prisma config reads
  **DATABASE_URL** for migrations, so scope that override to each command.
  [Neon TLS guidance](https://neon.com/blog/postgres-needs-better-connection-security-defaults) ·
  [node-postgres TLS](https://node-postgres.com/features/ssl) ·
  [Prisma TLS options](https://docs.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)

## Authorized maintenance window only

In the release repo, prompt privately for URLs already configured with
the TLS policy above. Do not export the direct production URL globally.
Confirm database and branch in Neon Console before using the variables.
The recovery target must be separately approved, empty, disposable,
and distinguishable by host. Keep release secrets out of command history,
shell traces, and shared output.

```fish
read -s -P 'Production direct libpq URL: ' STENO_PROD_PSQL
read -s -P 'Production direct Prisma CLI URL: ' STENO_PROD_PRISMA
read -s -P 'Empty disposable recovery direct libpq URL: ' STENO_RECOVERY_PSQL
read -s -P 'Same recovery database, direct Prisma CLI URL: ' STENO_RECOVERY_PRISMA
read -P 'Production direct hostname from Neon Console: ' STENO_PROD_HOST
read -P 'Recovery direct hostname from Neon Console: ' STENO_RECOVERY_HOST
env CHECK_PSQL="$STENO_PROD_PSQL" CHECK_PRISMA="$STENO_PROD_PRISMA" CHECK_RECOVERY="$STENO_RECOVERY_PSQL" CHECK_RECOVERY_PRISMA="$STENO_RECOVERY_PRISMA" CHECK_PROD_HOST="$STENO_PROD_HOST" CHECK_RECOVERY_HOST="$STENO_RECOVERY_HOST" node -e '
const e=process.env;
const urls=[e.CHECK_PSQL,e.CHECK_PRISMA,e.CHECK_RECOVERY,e.CHECK_RECOVERY_PRISMA].map(value=>new URL(value));
const [p,m,r,n]=urls;
if(p.hostname!==e.CHECK_PROD_HOST||r.hostname!==e.CHECK_RECOVERY_HOST||p.hostname===r.hostname||p.hostname!==m.hostname||r.hostname!==n.hostname||p.pathname!==m.pathname||r.pathname!==n.pathname||urls.some(u=>!u.hostname.endsWith(".neon.tech")||u.hostname.includes("-pooler"))) process.exit(1);
console.log("PASS: independently confirmed production and recovery direct hosts");
'
```

Stop if any gate fails. Gate user traffic including sign-in, background
jobs and old deployments before the final backup. Drain in-flight writes.
Do not rely on a Vercel alias change alone to prevent old instances
writing. A successful backup from before the drain can miss writes.
Review Neon compute, egress and storage headroom for backup, restore,
extra branch and migration traffic.

The report scripts use node-postgres. Derive driver-specific direct URLs
without printing them. This uses the Node trust store for certificate
and hostname verification. If the approved platform needs a custom CA,
configure the applicable Node CA file separately and test it.

```fish
function steno_pg_url --argument-names url
    env STENO_SOURCE_URL="$url" node -e 'const u=new URL(process.env.STENO_SOURCE_URL); for(const k of ["sslrootcert","channel_binding","uselibpqcompat"])u.searchParams.delete(k); u.searchParams.set("sslmode","verify-full");process.stdout.write(u.href)'
end
set STENO_PROD_PG (steno_pg_url "$STENO_PROD_PSQL")
set STENO_RECOVERY_PG (steno_pg_url "$STENO_RECOVERY_PSQL")
```

### Backup, migration ledger and disposable restore

```fish
set STENO_RELEASE_DIR (mktemp -d)
chmod 700 "$STENO_RELEASE_DIR"
psql "$STENO_PROD_PSQL" -X -v ON_ERROR_STOP=1 -c 'SELECT current_database(), ssl, version FROM pg_stat_ssl WHERE pid=pg_backend_pid();'
and pg_dump --dbname="$STENO_PROD_PSQL" --format=custom --file="$STENO_RELEASE_DIR/production-before.dump"
and chmod 600 "$STENO_RELEASE_DIR/production-before.dump"
and pg_restore --list "$STENO_RELEASE_DIR/production-before.dump" > "$STENO_RELEASE_DIR/archive.list"
and sha256sum "$STENO_RELEASE_DIR/production-before.dump" > "$STENO_RELEASE_DIR/archive.sha256"
```

Expect SSL true, a nonempty archive and zero exit status. The checksum
compares bytes in storage. Restoration proves recoverability. Keep the
private archive in approved protected storage. Confirm the recovery
database has no application schema before restoring.

```fish
psql "$STENO_RECOVERY_PSQL" -X -v ON_ERROR_STOP=1 -c "SELECT current_database(), to_regclass('public.\"_prisma_migrations\"');"
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$STENO_RECOVERY_PSQL" "$STENO_RELEASE_DIR/production-before.dump"
```

Expect an empty migration-table field before restore. Stop if the target
is nonempty or restoration fails. Original grants were intentionally not
applied to the disposable environment. Review or recreate equivalent
grants separately when using a recovery database for service.

Check migration ledgers without exposing data. The expected local list is
lexical and has three entries before this release and seven afterward.

```fish
function steno_check_ledger --argument-names url count
    set -l dir (mktemp -d)
    psql "$url" -X -v ON_ERROR_STOP=1 -A -t -F ' ' -c 'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name' > "$dir/remote"
    or return 1
    set -l bad (psql "$url" -X -v ON_ERROR_STOP=1 -A -t -c 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL')
    test "$bad" = 0; or return 1
    for directory in (printf '%s\n' prisma/migrations/*/ | sort | head -n "$count")
        set -l digest (sha256sum "$directory/migration.sql" | cut -d ' ' -f 1)
        printf '%s %s\n' (basename "$directory") "$digest"
    end > "$dir/local"
    diff -u "$dir/local" "$dir/remote"
end
steno_check_ledger "$STENO_PROD_PSQL" 3
and steno_check_ledger "$STENO_RECOVERY_PSQL" 3
```

Expect empty diff and zero exit. Reuse the existing populated-clone
fingerprint tool on the restore with guarded recovery variables.
Capture the private fingerprint before and after recovery migration.
Require exact equality apart from the ledger heading. If production has
multiple sessions per account, document the expected session-only change
and reconcile the surviving sessions separately. All genuine result and
account fingerprints must match.

```fish
env STENO_BRANCH_URL="$STENO_RECOVERY_PG" STENO_BRANCH_HOST="$STENO_RECOVERY_HOST" STENO_DISPOSABLE_DB=YES node scripts/db/verify-branch.mjs > "$STENO_RELEASE_DIR/restore-before.txt"
and env DATABASE_URL="$STENO_RECOVERY_PRISMA" pnpm exec prisma migrate deploy
and steno_check_ledger "$STENO_RECOVERY_PSQL" 7
and env STENO_BRANCH_URL="$STENO_RECOVERY_PG" STENO_BRANCH_HOST="$STENO_RECOVERY_HOST" STENO_DISPOSABLE_DB=YES node scripts/db/verify-branch.mjs --after > "$STENO_RELEASE_DIR/restore-after.txt"
and diff -u (tail -n 1 "$STENO_RELEASE_DIR/restore-before.txt" | psub) (tail -n 1 "$STENO_RELEASE_DIR/restore-after.txt" | psub)
```

If the recovery branch has newer known snapshots before this release,
that differs from the three-migration baseline. Stop and reconcile
with the ledger instead of rewriting checksums. Run the following against the restored data, then run the disposable
smoke and SSL checks using production-equivalent roles and URLs.

```fish
env DATABASE_URL="$STENO_RECOVERY_PRISMA" pnpm run db:check-sync
and env DATABASE_URL="$STENO_RECOVERY_PG" pnpm run db:verify
```

### Migrate and promote while traffic remains gated

```fish
steno_check_ledger "$STENO_PROD_PSQL" 3
and env DATABASE_URL="$STENO_PROD_PRISMA" pnpm exec prisma migrate deploy
and steno_check_ledger "$STENO_PROD_PSQL" 7
and env DATABASE_URL="$STENO_PROD_PRISMA" pnpm run db:check-sync
and env DATABASE_URL="$STENO_PROD_PG" pnpm run db:verify
```

Expect all four pending migrations and zero drift. Each migration has
its own transaction. A later failure can leave earlier migrations
committed. Stop for any mismatch, unknown migration state, unexpected
data count, lock failure or insufficient headroom. No `db push`,
`migrate dev`, seed, or blind `migrate resolve`. Promote the matching
prebuilt application in the hosting console only after the DB checks.
Keep the write gate until health checks and operator-approved smoke
account checks pass. Automated fixture suites are for disposable targets.

Collect counts without exposing user records:

```fish
psql "$STENO_PROD_PSQL" -X -v ON_ERROR_STOP=1 -c 'SELECT (SELECT count(*) FROM "TypingAttempt") AS active_attempts, (SELECT count(*) FROM "LegacyTypingAttemptArchive") AS archived_attempts, (SELECT count(*) FROM "user") AS users, (SELECT count(*) FROM "account") AS credentials, (SELECT count(*) FROM "StudentProfile") AS profiles, (SELECT count(*) FROM "Dictation") AS dictations;'
```

Post-cutover check the admin overview, student history, sign-in/out,
TLS and error logs. Compare result counts and legacy archive counts
against the restore rehearsal. If a real scoring write is authorized,
use an identified smoke account and check that retry returns the same
attempt. Reopen traffic gradually. Watch pool waits, the Neon Console
storage/compute/egress and 503/429 rates. App capacity warnings cover
storage estimates only.

## Rollback

Before public writes resume, the verified pre-cutover backup and
previous app form the rollback pair. Restore into a verified empty
recovery target with appropriate roles, then cut over the previous app
and its DB together. After independently verifying the empty rollback
endpoint and room in the Free plan, use:

```fish
read -s -P 'Approved empty rollback database direct libpq URL: ' STENO_ROLLBACK_PSQL
sha256sum --check "$STENO_RELEASE_DIR/archive.sha256"
and psql "$STENO_ROLLBACK_PSQL" -X -v ON_ERROR_STOP=1 -c "SELECT current_database(), to_regclass('public.\"_prisma_migrations\"');"
```

Stop unless the database identity and empty ledger are confirmed.
Only then restore and check the old ledger:

```fish
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$STENO_ROLLBACK_PSQL" "$STENO_RELEASE_DIR/production-before.dump"
and steno_check_ledger "$STENO_ROLLBACK_PSQL" 3
```
 Keep the failed database untouched for diagnosis.
A frontend-only rollback across these migrations is unsafe without
compatibility evidence. After real traffic resumes, prefer a reviewed
forward fix. If recovery is necessary, gate writes again, capture the
current database, and reconcile all post-backup results and accounts
before switching. Never overwrite a live database with an older dump
or discard post-backup student results. Keep login retention disabled.
