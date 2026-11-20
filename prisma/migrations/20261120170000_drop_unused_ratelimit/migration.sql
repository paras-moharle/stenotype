-- Remove the unused rate-limit table.
--
-- Better Auth is configured with `storage: 'memory'` (lib/auth-config.ts)
-- and nothing in the application reads this table. Keeping it invited
-- confusion about where throttling lives.
--
-- The build that is currently deployed has the model in its generated
-- client but never queries it, so dropping the table is safe.

DROP TABLE IF EXISTS "rateLimit";
