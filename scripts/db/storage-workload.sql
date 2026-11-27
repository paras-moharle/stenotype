\set ON_ERROR_STOP on
-- Session-local tables only. No writes to application tables.
BEGIN;
CREATE TEMP TABLE sample_snapshot (LIKE "TypingAttempt" INCLUDING ALL);
CREATE TEMP TABLE sample_shared (LIKE "TypingAttempt" INCLUDING ALL);
CREATE TEMP TABLE sample_reference (LIKE "DictationReference" INCLUDING ALL);
CREATE TEMP TABLE sample_text AS
SELECT reference, encode(sha256(convert_to(reference, 'UTF8')), 'hex') AS digest
FROM (SELECT left("referenceTranscript", 5000) AS reference
      FROM "Dictation" ORDER BY length("referenceTranscript") DESC, "id" LIMIT 1) AS input;

INSERT INTO sample_reference SELECT digest, reference FROM sample_text;
INSERT INTO sample_snapshot ("id","studentId","dictationId","typedText","elapsedMs","wpm","accuracy","referenceSnapshot","submissionKey")
SELECT i::text, (i % 100)::text, 'sample',
       left(reference, 2500) || ' ' || md5(i::text), 60000, 50, 98, reference, i::text
FROM generate_series(1, 2000) AS samples(i) CROSS JOIN sample_text;

INSERT INTO sample_shared ("id","studentId","dictationId","typedText","elapsedMs","wpm","accuracy","referenceDigest","scoreVersion","submissionKey")
SELECT "id","studentId","dictationId","typedText","elapsedMs","wpm","accuracy",digest,1,"submissionKey"
FROM sample_snapshot CROSS JOIN sample_text;

SELECT count(*) AS attempts, round(avg(octet_length("typedText"))) AS mean_typed_bytes,
       max(octet_length("referenceSnapshot")) AS reference_bytes,
       pg_total_relation_size('sample_snapshot') AS copied_reference_bytes,
       pg_total_relation_size('sample_shared') + pg_total_relation_size('sample_reference') AS shared_reference_bytes
FROM sample_snapshot;
ROLLBACK;
