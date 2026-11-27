# Database promotion assessment

The already migrated verification clone is a candidate for production. Its earlier migration and preservation checks establish a useful baseline. They do not establish that the original stopped receiving writes at cloning or that the candidate is free of test data. Promotion is simpler than migrating the original only if reconciliation and isolation pass. The [production release runbook](production-database-release.md) remains the fallback. This assessment authorizes no database operations.

## Read-only gate after explicit approval

1. In the Neon console record project ID, branch IDs, expected endpoints, parent and child links, default branch, protections, restore window, and Usage by branch. Confirm both URLs out of band. Use private, read-only connections with hostname-verifying TLS. Record the fork timestamp from branch metadata.
2. On each endpoint run the inventory below in one read-only repeatable-read transaction. Record schema, ledger and privilege differences. Compare checksums to all seven release files. The candidate must have seven completed, non-rolled-back migrations and no drift. Verify the application role can connect, use the schema, and perform required operations on application tables and sequences. Check inherited grants and ownership alongside ACL entries. Confirm that session replacement, submission uniqueness, and historical-reference constraints are valid.
3. Compare sorted exports by primary ID using an encrypted local workspace with mode 0700. Compare `user`, `account`, `StudentProfile` including user IDs, credential hashes, roles and blocked status. Compare `Dictation`, `TypingAttempt`, `DictationReference` and `LegacyTypingAttemptArchive` by ID. Derive the same historical reference text on both branches when a migration replaced a snapshot column with a reference row. Account for archived null-dictation attempts. Use private keyed digests of canonical rows for equality checks and report only counts and classifications externally. Check source-only, candidate-only and changed records. Timestamps after cloning are leads, since updates are not always timestamped and deleted rows require comparison against fork evidence. Inspect `session`, `verification`, `LoginAttempt` and `AbuseBucket` separately for test activity and security state. Do not publish private fields, tokens, hashes or row exports.
4. Classify records from fixture inventories, test run records and owner review. Keep unresolved records intact. Stop for conflicting genuine edits, ambiguous fixture provenance, or incomplete mappings. Inventory Vercel and local app env **names/scopes** separately. `DB_PROJECT_USAGE_PERCENT` is an application override, not a database setting. Check configured roles, PostgreSQL role/database settings and prior testing grants separately.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count
FROM public._prisma_migrations ORDER BY migration_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
SELECT conrelid::regclass, conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2;
SELECT tgrelid::regclass, tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN
(SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace) ORDER BY 1, 2;
SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY 2, 3;
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' ORDER BY 1, 2, 3;
COMMIT;
```

Use `has_database_privilege`, `has_schema_privilege`, `has_table_privilege` and `has_sequence_privilege` for the exact runtime role. Review role/database settings privately because settings may contain sensitive values.

## Later cutover sequence

1. Change the development preflight and test guards **before** promoting the endpoint. Pin a different disposable target or use local PostgreSQL. Remove the candidate from dev, preview and verification allowlists, disconnect those processes and revoke their write access to the candidate before it serves production. Keep production and development Better Auth secrets distinct. Preserve the existing production secret and origin at cutover. If sessions differ by branch, plan sign-in again and explicitly revoke copied sessions that should no longer be valid. Never revive sessions revoked on the source.
2. Secure backups of both branches using version-compatible `pg_dump -Fc` and private permissions. Take final backups after stopping all writers. Check `pg_restore --list`, then test restoring both to separate isolated databases. Verify counts, credential relationships, checksums, constraints and a representative historical result. Keep encrypted recovery copies outside the worktree.
3. Rehearse reconciliation on restored backups. Preserve IDs and credential hashes verbatim. Import approved genuine source-only changes in foreign-key order, explicitly map old attempt formats, and confirm all references and uniqueness. Remove only individually approved synthetic rows, in dependency order. Check before/after counts, exact IDs, orphan checks and transaction results before committing. Never truncate whole tables as cleanup. Re-run the final comparison under the write freeze.
4. With separate approval, switch only the production Vercel database target to the reconciled candidate and deploy the compatible app together. Keep the original branch available for recovery. Confirm sign-in, permissions, playback links, historic results and a controlled write. Confirm all environments use the intended target and no capacity-test override remains. Reopen writes only after checks pass.
5. Before reopening writes, reverting the application and endpoint together is an available rollback if unchanged backups and old runtime are valid. After candidate accepts genuine writes, freeze again and reconcile those writes before switching back. Prefer forward recovery if old schema cannot represent them.

Neon's default-branch designation and Vercel's database URL are separate. Setting the child as default leaves its lineage intact and can affect Neon-managed Vercel preview branching. Neon blocks deletion of branches with children, the default branch, protected branches, and the last root. If the original remains the candidate's parent, keeping the candidate and deleting the original is unavailable under the ordinary deletion rules. A child can use instant restore but lacks root-only snapshots and backup schedules. Neon directs users to Support for root conversion. Branch protection is a paid-plan feature.

Retaining the old branch preserves a recovery option while consuming a branch slot and potentially retained storage or compute if queried. Copy-on-write makes deletion savings differ from logical database size. The published Free limits include 10 branches, 1 GB storage, 100 compute-unit hours and 5 GB public transfer per project. Measure actual usage in the project console and avoid waking the old endpoint unnecessarily. A strict one-branch target favors migrating the original root unless a separate root conversion is approved.

Sources: [Neon branch management](https://neon.com/docs/manage/branches) [Neon Free plan allowances](https://neon.com/docs/introduction/plans) and [Neon copy-on-write storage](https://neon.com/storage).
