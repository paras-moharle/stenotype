BEGIN;
ALTER TABLE "TypingAttempt"
  ADD COLUMN "submissionKey" TEXT,
  ADD COLUMN "referenceSnapshot" TEXT,
  ADD COLUMN "rawWpm" INTEGER;

CREATE UNIQUE INDEX "TypingAttempt_studentId_submissionKey_key"
  ON "TypingAttempt"("studentId", "submissionKey");
COMMIT;
