BEGIN READ ONLY;
SELECT pg_database_size(current_database()) AS database_bytes;
SELECT pg_class.relname, pg_relation_size(relid) AS heap_bytes,
       pg_indexes_size(relid) AS index_bytes,
       CASE WHEN reltoastrelid = 0 THEN 0 ELSE pg_total_relation_size(reltoastrelid) END AS toast_bytes,
       pg_total_relation_size(relid) AS total_bytes,
       n_live_tup AS estimated_rows, n_dead_tup AS estimated_dead_rows
FROM pg_stat_user_tables
JOIN pg_class ON pg_class.oid = relid
ORDER BY total_bytes DESC;
COMMIT;
