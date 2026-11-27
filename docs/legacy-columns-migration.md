# Legacy typing attempt migration

The pending `20261125184500_drop_legacy_attempt_columns` migration runs in
an explicit PostgreSQL transaction. It locks the active attempt table,
writes complete null-dictation rows to `LegacyTypingAttemptArchive`,
then removes those rows from active history. Valid attempts keep their
identifiers and scoring data. It drops the two superseded character
columns from the active table and enforces a non-null, restricted
dictation relation.

The archive includes historical typed text and stays outside application
APIs. Keep a private pre-migration backup if the dropped columns from
valid attempts matter. Archive retention follows the same policy as
the historical attempts it contains.

Earlier restored-copy checks were performed against the pre-archive
version and do not verify this migration. Use a fresh disposable database
and follow the [verification runbook](engineering-verification.md).
A database that already recorded the older checksum requires a separate
rollout decision. Do not silently rewrite its migration ledger.
