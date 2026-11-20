-- Full scoring breakdown per attempt.
--
-- The earlier (lost) model stored the complete word and punctuation
-- breakdown, and that shape is what the result screen actually needs:
-- correct / wrong / extra / missed for words and for punctuation.
--
-- Every column is NOT NULL DEFAULT 0 on purpose: the build that is
-- currently deployed does not know these columns and will omit them on
-- insert, so a default keeps that build working. The API always writes
-- the real numbers.
--
-- `wordsCorrect`, `wordsTotal` and `completion` already exist from the
-- baseline; these add the rest of the breakdown.

ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "wordsIncorrect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "wordsExtra"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "wordsMissed"    INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "punctuationCorrect"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "punctuationIncorrect" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "punctuationExtra"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "punctuationMissed"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TypingAttempt" ADD COLUMN IF NOT EXISTS "punctuationTotal"     INTEGER NOT NULL DEFAULT 0;
