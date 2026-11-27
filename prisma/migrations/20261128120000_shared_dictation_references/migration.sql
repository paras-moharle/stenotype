BEGIN;

LOCK TABLE "TypingAttempt" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE "DictationReference" (
  "digest" TEXT NOT NULL PRIMARY KEY,
  "transcript" TEXT NOT NULL,
  CONSTRAINT "DictationReference_content_digest" CHECK ("digest" = encode(sha256(convert_to("transcript", 'UTF8')), 'hex'))
);

ALTER TABLE "TypingAttempt"
  ADD COLUMN "referenceDigest" TEXT,
  ADD COLUMN "scoreVersion" INTEGER;

INSERT INTO "DictationReference" ("digest", "transcript")
SELECT DISTINCT encode(sha256(convert_to("referenceSnapshot", 'UTF8')), 'hex'), "referenceSnapshot"
FROM "TypingAttempt" WHERE "referenceSnapshot" IS NOT NULL;

UPDATE "TypingAttempt"
SET "referenceDigest" = encode(sha256(convert_to("referenceSnapshot", 'UTF8')), 'hex'),
    "scoreVersion" = 1,
    "referenceSnapshot" = NULL
WHERE "referenceSnapshot" IS NOT NULL;

ALTER TABLE "TypingAttempt" ADD CONSTRAINT "TypingAttempt_referenceDigest_fkey"
  FOREIGN KEY ("referenceDigest") REFERENCES "DictationReference"("digest")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

COMMIT;
