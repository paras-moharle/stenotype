-- Run only after the baseline migration on a disposable branch.
BEGIN;
INSERT INTO "user" ("id", "email", "name", "updatedAt")
VALUES ('legacy-fixture-user', 'legacy-fixture@example.test', 'Legacy fixture', now());
INSERT INTO "StudentProfile" ("id", "userId", "updatedAt")
VALUES ('legacy-fixture-student', 'legacy-fixture-user', now());
INSERT INTO "Dictation" ("id", "title", "category", "status", "referenceTranscript", "createdById", "updatedAt")
VALUES ('legacy-fixture-dictation', 'Legacy fixture', 'GENERAL', 'ARCHIVED', 'Fixture text.', 'legacy-fixture-user', now());
INSERT INTO "TypingAttempt" ("id", "studentId", "dictationId", "typedText", "elapsedMs", "wpm", "accuracy", "correctCharacters")
VALUES
  ('legacy-fixture-null-attempt', 'legacy-fixture-student', NULL, 'Legacy sample', 3000, 0, 0, 7),
  ('legacy-fixture-valid-attempt', 'legacy-fixture-student', 'legacy-fixture-dictation', 'Fixture text.', 60000, 3, 100, 13);
COMMIT;
