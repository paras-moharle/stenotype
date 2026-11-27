-- Preserve complete legacy rows before removing them from active history.
BEGIN;
LOCK TABLE "TypingAttempt" IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE "LegacyTypingAttemptArchive" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "row" JSONB NOT NULL
);

INSERT INTO "LegacyTypingAttemptArchive" ("id", "row")
SELECT attempt."id", to_jsonb(attempt)
FROM "TypingAttempt" AS attempt
WHERE attempt."dictationId" IS NULL;

DELETE FROM "TypingAttempt" WHERE "dictationId" IS NULL;

-- DropForeignKey
ALTER TABLE "TypingAttempt" DROP CONSTRAINT "TypingAttempt_dictationId_fkey";

-- AlterTable
ALTER TABLE "TypingAttempt" DROP COLUMN "correctCharacters",
DROP COLUMN "incorrectCharacters",
ALTER COLUMN "dictationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "TypingAttempt" ADD CONSTRAINT "TypingAttempt_dictationId_fkey" FOREIGN KEY ("dictationId") REFERENCES "Dictation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
