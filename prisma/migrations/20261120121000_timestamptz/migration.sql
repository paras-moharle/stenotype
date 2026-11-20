-- Store absolute instants, not wall-clock text.
--
-- Prisma wrote DateTime into `timestamp(3)` (no zone), i.e. it stored the
-- UTC wall clock with nothing recording that it was UTC. Any client that
-- did not assume UTC — Prisma Studio, psql, an export — displayed a time
-- that was wrong by the IST offset (and ambiguous).
--
-- Moving every timestamp to `timestamptz(3)` records the instant. The app
-- formats it explicitly with `timeZone: 'Asia/Kolkata'`, so every screen
-- and every DB client agree on when something happened.
--
-- Existing values were written by Prisma as UTC, so they are reinterpreted
-- as UTC rather than shifted.

ALTER TABLE "user"        ALTER COLUMN "banExpires" TYPE TIMESTAMPTZ(3) USING "banExpires" AT TIME ZONE 'UTC';
ALTER TABLE "user"        ALTER COLUMN "createdAt"  TYPE TIMESTAMPTZ(3) USING "createdAt"  AT TIME ZONE 'UTC';
ALTER TABLE "user"        ALTER COLUMN "updatedAt"  TYPE TIMESTAMPTZ(3) USING "updatedAt"  AT TIME ZONE 'UTC';

ALTER TABLE "LoginAttempt" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "StudentProfile" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "StudentProfile" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "Dictation" ALTER COLUMN "createdAt"   TYPE TIMESTAMPTZ(3) USING "createdAt"   AT TIME ZONE 'UTC';
ALTER TABLE "Dictation" ALTER COLUMN "updatedAt"   TYPE TIMESTAMPTZ(3) USING "updatedAt"   AT TIME ZONE 'UTC';
ALTER TABLE "Dictation" ALTER COLUMN "publishedAt" TYPE TIMESTAMPTZ(3) USING "publishedAt" AT TIME ZONE 'UTC';

ALTER TABLE "TypingAttempt" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

ALTER TABLE "session" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "session" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "session" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "account" ALTER COLUMN "accessTokenExpiresAt"  TYPE TIMESTAMPTZ(3) USING "accessTokenExpiresAt"  AT TIME ZONE 'UTC';
ALTER TABLE "account" ALTER COLUMN "refreshTokenExpiresAt" TYPE TIMESTAMPTZ(3) USING "refreshTokenExpiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "account" ALTER COLUMN "createdAt"             TYPE TIMESTAMPTZ(3) USING "createdAt"             AT TIME ZONE 'UTC';
ALTER TABLE "account" ALTER COLUMN "updatedAt"             TYPE TIMESTAMPTZ(3) USING "updatedAt"             AT TIME ZONE 'UTC';

ALTER TABLE "verification" ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC';
ALTER TABLE "verification" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "verification" ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
