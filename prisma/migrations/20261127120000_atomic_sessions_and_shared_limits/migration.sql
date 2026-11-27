BEGIN;

LOCK TABLE "session" IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "userId" ORDER BY "createdAt" DESC, "id" DESC
  ) AS position FROM "session"
)
DELETE FROM "session" AS existing
USING ranked
WHERE existing."id" = ranked."id" AND ranked.position > 1;

DROP INDEX "session_userId_idx";
CREATE UNIQUE INDEX "session_userId_key" ON "session"("userId");

CREATE FUNCTION replace_user_session() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  account_banned boolean;
  ban_expires timestamptz;
BEGIN
  SELECT "banned", "banExpires" INTO account_banned, ban_expires
  FROM "user" WHERE "id" = NEW."userId" FOR NO KEY UPDATE;
  IF NOT FOUND OR (account_banned AND (ban_expires IS NULL OR ban_expires > CURRENT_TIMESTAMP)) THEN
    RAISE EXCEPTION 'Session creation denied';
  END IF;
  DELETE FROM "session" WHERE "userId" = NEW."userId";
  RETURN NEW;
END;
$$;

CREATE TRIGGER "replace_user_session_before_insert"
BEFORE INSERT ON "session"
FOR EACH ROW EXECUTE FUNCTION replace_user_session();

CREATE TABLE "AbuseBucket" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "AbuseBucket_resetAt_idx" ON "AbuseBucket"("resetAt");

COMMIT;
