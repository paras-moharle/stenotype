BEGIN;

-- Stop all application writers while running the dry run and this migration.
LOCK TABLE "TypingAttempt" IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "TypingAttempt" ADD COLUMN "practiceExpiresAt" timestamptz(3);

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY "studentId", "dictationId" ORDER BY "createdAt" DESC, id DESC
  ) AS position
  FROM "TypingAttempt"
)
DELETE FROM "TypingAttempt" AS attempt
USING ranked WHERE attempt.id = ranked.id AND ranked.position > 1;

-- Legacy rows have no signed issuance timestamp. Fence off every ticket
-- issued at or before the retained result's acceptance timestamp.
UPDATE "TypingAttempt"
SET "practiceExpiresAt" = "createdAt" + interval '8 hours';

CREATE UNIQUE INDEX "TypingAttempt_studentId_dictationId_key"
  ON "TypingAttempt" ("studentId", "dictationId");

COMMIT;
