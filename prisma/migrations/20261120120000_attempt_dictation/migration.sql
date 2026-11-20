-- Attempts belong to the dictation they were scored against, and carry
-- meaningful result numbers.
--
-- IMPORTANT / history
-- -------------------
-- The live database already applied `20261117120000_dictation_attempts`
-- on 2026-11-17. That migration file was lost from the repository, but it
-- is what created `dictationId`, `completion`, the `words*` and
-- `punctuation*` counters, dropped `typingTestId` and removed the orphan
-- tables. Because the file is gone, this migration is written to be
-- **idempotent**: it reaches the same end state on a database that has
-- already been through it and on one that has not.
--
-- This statement is safe on both, which is why `IF NOT EXISTS` and
-- `IF EXISTS` are used throughout. Do not "tidy" them away.

-- ── 1. Dictation link ──────────────────────────────────────
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "dictationId" TEXT;

CREATE INDEX IF NOT EXISTS "TypingAttempt_dictationId_idx"
  ON "TypingAttempt"("dictationId");

-- The applied migration used ON DELETE SET NULL, which would silently
-- orphan a stored result. Results belong to their dictation: block the
-- delete instead of leaving a row that no screen can show.
ALTER TABLE "TypingAttempt" DROP CONSTRAINT IF EXISTS "TypingAttempt_dictationId_fkey";
ALTER TABLE "TypingAttempt"
  ADD CONSTRAINT "TypingAttempt_dictationId_fkey"
  FOREIGN KEY ("dictationId") REFERENCES "Dictation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 2. Meaningful result numbers ───────────────────────────
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "completion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "wordsCorrect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "wordsTotal" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TypingAttempt" ALTER COLUMN "completion" DROP DEFAULT;
ALTER TABLE "TypingAttempt" ALTER COLUMN "wordsCorrect" DROP DEFAULT;
ALTER TABLE "TypingAttempt" ALTER COLUMN "wordsTotal" DROP DEFAULT;

-- ── 3. Remove the misleading / unused counters ─────────────
-- `correctCharacters` / `incorrectCharacters` were character-level
-- alignment numbers, not comparable with WPM or word accuracy: one
-- stored row had 173 "incorrect" characters for a 20-character entry.
-- The `words*` / `punctuation*` counters added by the lost migration are
-- never read by the application; `completion`, `wordsCorrect` and
-- `wordsTotal` are the numbers the result panel shows.
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "correctCharacters";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "incorrectCharacters";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "wordsIncorrect";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "wordsExtra";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "wordsMissed";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "punctuationCorrect";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "punctuationIncorrect";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "punctuationExtra";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "punctuationMissed";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "punctuationTotal";

-- ── 4. Abandoned typing-test link ──────────────────────────
ALTER TABLE "TypingAttempt" DROP CONSTRAINT IF EXISTS "TypingAttempt_typingTestId_fkey";
DROP INDEX IF EXISTS "TypingAttempt_typingTestId_idx";
ALTER TABLE "TypingAttempt" DROP COLUMN IF EXISTS "typingTestId";

-- ── 5. Orphan schema objects ───────────────────────────────
-- The lost migration removed these on the live database. Dropping them
-- here makes a freshly migrated database converge to the same schema
-- instead of carrying dead tables and enum types forever.
DROP TABLE IF EXISTS "Assignment" CASCADE;
DROP TABLE IF EXISTS "Attempt" CASCADE;
DROP TABLE IF EXISTS "EvaluationResult" CASCADE;
DROP TABLE IF EXISTS "EvaluationError" CASCADE;
DROP TABLE IF EXISTS "TypingTest" CASCADE;
DROP TABLE IF EXISTS "Fee" CASCADE;
DROP TABLE IF EXISTS "Schedule" CASCADE;
DROP TABLE IF EXISTS "Announcement" CASCADE;
DROP TABLE IF EXISTS "Batch" CASCADE;

DROP TYPE IF EXISTS "AssignmentTargetType";
DROP TYPE IF EXISTS "AttemptStatus";
DROP TYPE IF EXISTS "EvaluationErrorType";
DROP TYPE IF EXISTS "ScheduleStatus";
DROP TYPE IF EXISTS "TypingTestStatus";
