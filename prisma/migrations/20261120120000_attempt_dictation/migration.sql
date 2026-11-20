-- Attempts belong to the dictation they were scored against.
--
-- Product rule: only dictation results are persisted. Free practice and
-- custom text stay local to the browser, so a stored attempt always has
-- a dictation. The column is added nullable because the migration must
-- be safe against any legacy rows; the API refuses to write a row
-- without a dictation id.

-- CreateAlter
ALTER TABLE "TypingAttempt" ADD COLUMN "dictationId" TEXT;

-- CreateIndex
CREATE INDEX "TypingAttempt_dictationId_idx" ON "TypingAttempt"("dictationId");

-- AddForeignKey
ALTER TABLE "TypingAttempt"
  ADD CONSTRAINT "TypingAttempt_dictationId_fkey"
  FOREIGN KEY ("dictationId") REFERENCES "Dictation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Meaningful stored result numbers.
--
-- The old "correctCharacters"/"incorrectCharacters" were character-level
-- alignment matches. They are not comparable with WPM or accuracy: a run
-- typed without spaces can report ~112 "correct characters" while scoring
-- 3% word accuracy and a handful of WPM. Store the numbers the result
-- panel actually shows instead.
ALTER TABLE "TypingAttempt" ADD COLUMN "completion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ALTER COLUMN "completion" DROP DEFAULT;

ALTER TABLE "TypingAttempt" ADD COLUMN "wordsCorrect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ALTER COLUMN "wordsCorrect" DROP DEFAULT;

ALTER TABLE "TypingAttempt" ADD COLUMN "wordsTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ALTER COLUMN "wordsTotal" DROP DEFAULT;

ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "correctCharacters";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "incorrectCharacters";

-- The abandoned typing-test link is superseded by dictationId. It only
-- ever existed in the migrations, never in the Prisma schema, and no
-- application code has written it since the dictation pivot.
ALTER TABLE "TypingAttempt" DROP CONSTRAINT IF EXISTS "TypingAttempt_typingTestId_fkey";
DROP INDEX IF EXISTS "TypingAttempt_typingTestId_idx";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "typingTestId";
