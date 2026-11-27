-- Run on the migrated disposable branch after the HTTP tests.
BEGIN READ ONLY;

EXPLAIN (ANALYZE, BUFFERS)
SELECT ta."id", ta."wpm", ta."accuracy", d."title"
FROM "TypingAttempt" AS ta JOIN "Dictation" AS d ON d."id" = ta."dictationId"
ORDER BY ta."createdAt" DESC, ta."id" DESC LIMIT 5;

EXPLAIN (ANALYZE, BUFFERS)
SELECT ta."id", ta."wpm", ta."accuracy"
FROM "TypingAttempt" AS ta
WHERE ta."studentId" = (
  SELECT "studentId" FROM "TypingAttempt" ORDER BY "createdAt" DESC LIMIT 1
)
ORDER BY ta."createdAt" DESC, ta."id" DESC LIMIT 51;

EXPLAIN (ANALYZE, BUFFERS)
SELECT "id", "title", "category" FROM "Dictation"
WHERE "status" = 'PUBLISHED'
ORDER BY "createdAt" DESC, "id" DESC LIMIT 26;

COMMIT;
