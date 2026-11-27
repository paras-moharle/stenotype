# Result review and release verification

The reference comparison lives below the score table. Free and custom
practice display reached text first. A collapsed disclosure gives the
remaining token count and the muted suffix. The score table still counts
all omitted words and punctuation in Missed, including that suffix.
The disclosure does not start a run or contact the server.

The display uses the same start-anchored token alignment as the score.
An equal or substituted reference token establishes reach. Earlier
deletions are missed, while trailing deletions are not reached. The existing
rule treats final punctuation as missed when the last reference word was
reached. Inserted tokens are separately identified as extra and cannot
extend the reached boundary. The presentation does not infer reach from
the length of the typed string. A partially typed or ambiguous word uses
the existing whole-token substitution rather than guessing which of its
letters were intended. Repeated words and entirely incorrect input follow
the deterministic alignment, and the result cannot establish the typist's
intent. An empty attempt has no reached reference.

Dictation comparisons show the complete authorized transcript, including
trailing omissions, in one keyboard-focusable reading area. A historical
result uses the same comparison and its saved reference. The result
table, scoring formulas, worker and server persistence were kept.

Custom practice currently has an elapsed clock and no selectable time
limit. Its input is sanitized and validated against the same minimum
and maximum before application, and its results stay local. The offline
suite covers empty input, normalization, length rejection, exact scoring
at the supported maximum and persistence gating. Real browser acceptance
of login, opening and cancelling the editor, long custom completion and
cross-mode switching remains pending disposable credentials.
Dictation discovery, playback, auth lifecycle, persistence, historical
ownership and admin editing still require authenticated acceptance.
No live player was exercised in this pass.

## Test inventory

The preceding 205-to-196 pass-count drop equals the replacement of 14
passage cases with five consolidated cases. The worktree's pre-overhaul
offline log also contains the two cases for Full-to-30 restoration and
avoiding the displayed text that were absent from HEAD's 12-test file.
There was no change in the test discovery command. The new gated 60-second
browser case explains the skip count rising from 12 to 13.

The five consolidated checks cover bank/category validity, typeability,
sanitizer stability, deterministic seeding, invalid seed, repeat avoidance
and full/short restoration. They add metadata, lexical similarity, timer
eligibility, storage failures and 3,000 balanced Mixed selections. The old
50–100-word restriction and targetWords filter and invalid-target API tests
were retired because those contracts were replaced by the length-aware
architecture. This review adds three reference-presentation unit cases,
one custom maximum-length case and one browser review regression.

## Remaining acceptance against the verified clone

Confirm in the Neon dashboard that stenotype-verification independently
shows the following direct hostname. Use the existing disposable users and
approved test records only. These commands do not seed, migrate or reset a
database.

```fish
cd (git rev-parse --show-toplevel)
read -s -P 'Disposable direct connection URL: ' STENO_BRANCH_URL
set -gx STENO_BRANCH_URL "$STENO_BRANCH_URL"
set -gx STENO_BRANCH_HOST ep-holy-sun-bbvyyis1.c-15.us-east-1.aws.neon.tech
node -e 'try { const u = new URL(process.env.STENO_BRANCH_URL); if (u.hostname !== process.env.STENO_BRANCH_HOST) process.exit(1); } catch { process.exit(1); }'
or return 1
set -gx DATABASE_URL "$STENO_BRANCH_URL"
set -gx STENO_INTEGRATION_DATABASE_URL "$STENO_BRANCH_URL"
set -gx STENO_DISPOSABLE_DB YES
set -e STENO_EXPECT_LEGACY_FIXTURE
set -gx DB_LOGIN_RETENTION_DAYS 0
node --import tsx --test tests/db-integration.test.mjs
set -gx BETTER_AUTH_URL http://localhost:3000
set -gx BETTER_AUTH_SECRET (openssl rand -hex 32)
set -gx DB_PROJECT_USAGE_PERCENT 0
pnpm build
and pnpm start
```

In a second terminal:

```fish
cd (git rev-parse --show-toplevel)
read -s -P 'Disposable admin password: ' ADMIN_PASSWORD
read -s -P 'Disposable student password: ' SMOKE_PASSWORD
read -P 'Disposable admin email: ' ADMIN_EMAIL
read -P 'Disposable student email: ' SMOKE_EMAIL
set -gx ADMIN_PASSWORD "$ADMIN_PASSWORD"
set -gx SMOKE_PASSWORD "$SMOKE_PASSWORD"
set -gx ADMIN_EMAIL "$ADMIN_EMAIL"
set -gx SMOKE_EMAIL "$SMOKE_EMAIL"
set -gx SMOKE_BASE_URL http://localhost:3000
set -gx STENO_E2E_URL http://localhost:3000
node --import tsx --test tests/auth-http.test.mjs
and node --import tsx --test tests/typing-ui-browser.test.mjs
```

The integration suite should report one pass and the pre-migration fixture
skip. For the capacity check restart the verified clone app from the
first terminal using `env DB_PROJECT_USAGE_PERCENT=80 pnpm start`, then run
`env STENO_CAPACITY_TEST_URL=http://localhost:3000 node --import tsx --test tests/db-capacity-http.test.mjs`
from the second terminal with the same disposable credentials.

Record remaining manual acceptance for a completed untimed custom result,
long live and historical dictation results, cross-mode switching before,
during and after typing, two-student isolation, unavailable YouTube videos
and native IME. The [release checklist](pre-release-verification.md#git-preparation)
lists explicit staging paths. Confirm preview branch settings and disposable
credentials before pushing and follow the separate schema cutover runbook
before production promotion.
