# Single saved dictation results

One student and dictation pair has one saved row. Results links retain their
identity and open the current comparison. A successful newer practice
replaces the row, including its reference, text, metrics, duration and saved
timestamp. A rejected submission leaves that row intact.

A practice ticket is valid for eight hours. PostgreSQL supplies the issuance
clock. The result stores the signed expiry as an ordering watermark because
all tickets have the same lifetime. The account lock orders writes, and the
publication lock guards archive, unpublish, recording changes and deletion.
A later-issued ticket may replace the current result. Equal millisecond
timestamps cannot supersede another result. Matching current retries return
the saved comparison within the ticket lifetime. Older retries get a
conflict. There is no submission receipt table. Deleted account and dictation
identities cannot be recreated by a ticket. Keep all old writers disabled
during migration and release.

## Maintenance

Successful logins and credential failures for known accounts are best-effort
and capacity-gated. Student and detached login records default to 30 days.
Linked administrator records use the current account role and default to
90 days. Older detached records lack a reliable administrator role, so they
follow the student window. Unknown-email failures still use the independent
rate limiter. Ordinary deletion and purge remove records linked by stable ID
before the user row. Detached records follow age-based retention.

Traffic schedules a background batch after the response. A durable gate and
a PostgreSQL advisory transaction lock limit execution across instances.
Each run removes at most 1,000 old login events and at most 100 each of
expired sessions, expired buckets and expired non-application verification rows.
The default interval is daily. Run an explicit batch with the authorized
target URL already set:

```sh
pnpm db:maintain --apply
```

The command does not need spare capacity for new user data. Inspect existing
overrides when deploying. Set `DB_MAINTENANCE_SECONDS=86400`,
`DB_LOGIN_RETENTION_DAYS=30` and `DB_ADMIN_LOGIN_RETENTION_DAYS=90` for the
default policy. A retention value of zero disables that group. Each batch
can be repeated while draining a backlog. The receipt and maintenance
namespaces stay outside verification cleanup. A backlog can temporarily
retain data longer than its target window.

Immutable transcript references remain intact because outstanding tickets can
need a reference even when no saved result points to it. Automatic reference
reclamation is deferred. Ordinary autovacuum makes obsolete row space
available for reuse. Updates to the indexed submission key and timestamp
preclude HOT updates for normal replacements. Physical sizes can remain at
their high-water mark, and Neon accounts for project history separately.

## Destructive consolidation rollout

1. Confirm the target independently and inventory all old write-capable
   deployments and clients. Stop their writes and drain in-flight requests.
2. Take a consistent backup and rehearse recovery to a separate database.
   Keep the original migration files and ledger.
3. Run `scripts/db/single-result-dry-run.sql` against the gated target with
   the approved direct PostgreSQL connection. Record totals, retained pairs,
   removals and the estimated row-byte difference. The approximation does
   not predict physical disk reclamation.
4. Obtain approval for the counts and the data removal. Apply the eighth
   migration only after approval. It retains the newest saved row per pair
   by saved timestamp and descending ID, adds the unique index and leaves
   the legacy archive unchanged. It does not rescore retained rows.
5. Verify the ledger, schema, retained counts, shared references and the
   sampled result content. Bring up one compatible deployment and smoke-test
   creation, replacement, delayed retry, suspension, and result review
   before reopening writes.
6. If deployment fails, keep writes gated and use a compatible build.
   Reverting schema does not restore deleted rows. Full recovery requires
   the pre-migration backup. If the new deployment has already accepted
   writes, preserve or reconcile them before restoring an older snapshot.
