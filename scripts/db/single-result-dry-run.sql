BEGIN READ ONLY;
WITH ranked AS (
  SELECT row_number() OVER (
    PARTITION BY "studentId", "dictationId" ORDER BY "createdAt" DESC, id DESC
  ) AS position, pg_column_size(a) AS row_bytes
  FROM "TypingAttempt" a
)
SELECT count(*) AS existing_results,
       count(*) FILTER (WHERE position = 1) AS unique_pairs_and_retained,
       count(*) FILTER (WHERE position > 1) AS removed,
       coalesce(sum(row_bytes) FILTER (WHERE position > 1), 0) AS estimated_removed_row_bytes,
       pg_total_relation_size('"TypingAttempt"') AS current_relation_bytes
FROM ranked;
SELECT count(*) AS legacy_archive_rows FROM "LegacyTypingAttemptArchive";
ROLLBACK;
