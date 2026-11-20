# Migrations

## Current state

There is **one** migration: `20261120150000_init`. It is a baseline
generated from `prisma/schema.prisma`, and it reproduces the live
database exactly.

### How this was verified

```bash
# 1. live database -> schema (must print "This is an empty migration.")
npx prisma migrate diff --from-config-datasource \
  --to-schema prisma/schema.prisma --script

# 2. schema -> empty database (apply the folder, then diff)
#    done on a throwaway database; both directions were empty
npm run db:check-sync
```

`npm run db:check-sync` exits non-zero if the live database drifts from
the schema, so it can be used as a pre-deploy guard.

## Why there is only one migration

The project's migration history had drifted badly:

- The live database had applied `20261117120000_dictation_attempts`
  (2026-11-17), but **that file no longer exists anywhere** — it was
  part of work that was lost. It had created `dictationId`,
  `completion`, the `words*` / `punctuation*` counters, dropped
  `typingTestId` and removed eight orphan tables.
- The repository still carried the earlier migrations, so a fresh
  database could never reach the live schema.
- The orphan tables and five unused enum types were still declared in
  `schema.prisma`.

Squashing to a single baseline makes the folder, the schema and the
live database describe the same thing again. The old migration files
remain in git history if they are ever needed for reference.

## Compatibility with the deployed build

The live site still runs the code from `b304f22`, whose Prisma model
selects and inserts `correctCharacters` / `incorrectCharacters`, and
knows nothing about `dictationId`, `completion`, `wordsCorrect` or
`wordsTotal`. The live database therefore keeps:

- `correctCharacters` / `incorrectCharacters` — legacy counters, with
  defaults so the new API can omit them.
- defaults (`0`) on `completion`, `wordsCorrect`, `wordsTotal` — so the
  deployed build, which omits them, can still insert.
- `ON DELETE SET NULL` on `dictationId` — the behaviour the deployed
  build expects when a dictation is deleted.

Verified directly against the live database (inside a rolled-back
transaction):

```
deployed-build SELECT  -> OK
deployed-build INSERT  -> OK
new-build INSERT       -> OK
```

These compatibility columns are deliberate debt. Remove them in a
follow-up migration once the new build is deployed.

## Rules going forward

1. **Never edit a migration that has been applied.** Add a new one.
2. `prisma migrate dev` needs a shadow database. On Neon, set
   `SHADOW_DATABASE_URL` to a separate database in the same branch and
   add `shadowDatabaseUrl` to `prisma.config.ts` before using it.
3. After any schema change, run `npm run db:check-sync` and commit the
   migration together with the schema change.
4. Only dictation attempts are persisted. `TypingAttempt.dictationId`
   is nullable in the database so the baseline is safe on existing
   rows, but the API never writes a row without one.
