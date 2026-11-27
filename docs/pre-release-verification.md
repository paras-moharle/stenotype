# Pre-release verification

This review recorded the linked `audit/fixes` worktree. At review start its index was empty and its working tree
contained the accumulated engineering, migration and redesign work.
The local candidate is suitable for a reviewed commit. Hold production
promotion until the outstanding gates below pass.

## Typing feedback and scoring

Typing-only tokens use #22C55E, #FF5454 and #FACC15 in dark mode and
#176333, #A2212B and #775000 in light mode. The brighter red increases
luminance on charcoal. Chromium measured foreground/background ratios of
8.08, 5.83 and 12.03 against the dark surface token and 7.10, 7.31 and
6.95 in light mode. The live passage, completion comparison and shared
historical comparison use these tokens. Incorrect text is dotted
underlined, omitted characters in the passage review are dashed
underlined and extras are struck through. Review also groups errors and
omissions by name. Manual color-vision and mobile IME acceptance is open.

The formulas in lib/typing/scoring.ts were retained. Gross WPM uses
normalized typed characters divided by five and elapsed minutes. Net WPM
applies attempted accuracy before rounding. Attempted accuracy uses
evaluated words and punctuation, while completion counts retained reference
characters. A 30-character exact prefix of a 60-character reference in
30 seconds is 12 gross WPM, 12 net WPM and 50% completion when it ends
at a complete item boundary and meets the scoring minimum. Worker parity,
submission contracts and existing scoring fixtures cover these paths.

## Passage content and selection

All stock prose is in lib/passage-generator.ts. It selects original
predefined paragraphs by topic. The public server page prerenders the
first draw, with a 60-second revalidation interval. Browser draws use
per-pool Fisher–Yates shuffle bags driven by a time/random-seeded
pseudorandom generator. Explicit seeds are deterministic. Mixed chooses
a topic first. A bag refill avoids repeating the preceding draw, and New
passage also supplies the currently displayed text to the generator.
Memory resets with a new runtime, and a reload can show the same prerendered
initial passage. The selector has no persistence or external calls.

| Topic | Count | Min | Max | Median | Mean words |
| --- | ---: | ---: | ---: | ---: | ---: |
| Legal | 17 | 60 | 81 | 76 | 74.35 |
| Professional | 17 | 62 | 78 | 74 | 73.53 |
| General | 17 | 67 | 76 | 74 | 73.59 |
| Overall | 51 | 60 | 81 | 75 | 73.82 |

Counts use whitespace-delimited words. The collection contains 1,408
distinct case-folded alphabetic tokens, 220 sentence terminators and
426 punctuation marks including apostrophes and hyphens. That is about
17 words per sentence and 11.3 punctuation marks per 100 words. Exact
duplicates were absent. Maximum pairwise Jaccard similarity on unique
word sets was 0.209, a lexical check with no semantic duplicate guarantee.
Legal examples practice procedural vocabulary across hearings, arbitration,
registry work and disputes. They are fictional exercises. Professional
examples cover reviews, budgets, training, client communication and
operations. General passages cover ordinary places, work and routines.
There is no calibrated difficulty scale.

The content itself occupies 22,661 UTF-8 bytes. A production HTML inspection
counted 14 unique script sources totaling 803,932 raw bytes and 256,923
bytes when gzipped separately. These are file sizes, without network traces,
worker fetches or a module-level attribution. The prior 722 KB reported
number cannot be compared directly without matching measurement scope.
The entire bank is statically imported through the client selector.

Keep curated paragraphs as the unit of selection. A larger bank can improve
variety if reviewed by topic and difficulty. For an expansion to 150–300
items, split content by category and load it on selection, preserving the
server-seeded preview. Sentence assembly only makes sense within a curated
narrative or longer source. Procedural templates add variation at the
expense of natural prose. A hybrid may support longer drills by selecting
coherent excerpts at sentence boundaries. Offline AI-assisted drafts would
require editorial and duplicate checks, particularly for fictional legal
content. No expansion or runtime generator ships in this pass.

| Speed | 15 seconds | 30 seconds | 60 seconds |
| --- | ---: | ---: | ---: |
| 30 WPM | 7.5 | 15 | 30 |
| 60 WPM | 15 | 30 | 60 |
| 100 WPM | 25 | 50 | 100 |
| 150 WPM | 37.5 | 75 | 150 |
| 200 WPM | 50 | 100 | 200 |

These are nominal five-character WPM estimates compared with natural word
counts, so punctuation and vocabulary change the actual cutoff. Full
passages generally cover 15 seconds at these speeds. At 30 seconds fast
typists can finish early, and at 60 seconds this is expected above roughly
60–80 WPM. First 30 Words intentionally finishes early more frequently.
The public copy now explains that finishing the passage also ends a run.
Keep 15/30/60/Off as caps and untimed mode. Timed endurance would merit a
separate longer-text format with explicit acceptance criteria.

## Release gates

- HIGH, production compatibility. The attempts handler uses shared
  references and submission keys. Authentication expects the session trigger
  and shared quotas. A database at the first three migrations cannot serve
  this build safely. Follow the production runbook and coordinate schema
  and application cutover. The previously reported clone verification is
  historical evidence. Runtime role privileges, RLS status and live TLS
  on the release endpoint remain open. RLS would require reliable actor
  context within pooled transactions and deliberate treatment of Better Auth
  and administrative traffic. Review least-privilege grants first.
- MEDIUM, defense in depth. CSP remains Report-Only. Dictation opens YouTube externally. Verify
  outbound navigation and the normal app flows before enforcing a policy.
  The student detail query constrains both attempt ID and student profile.
  Complete the two-student and administrator browser matrix before release.
- MEDIUM, environment. README no longer advertises Resend and the template
  no longer advertises the unused shadow URL. Set the explicit Better Auth
  origin and a generated secret per environment. Override DATABASE_URL with
  the independently confirmed clone URL before launching an authenticated
  local build. The runtime normalizes Neon sslmode to verify-full.
- INFORMATIONAL, sensitive artifacts. Keep local agent skills, backups,
  screenshots, .env files and generated files out of the release commit.
  Filename-only pattern scans flagged the ignored .env as expected.
  Common token and connection patterns found no other matching worktree or
  client asset paths. Pattern scanning does not establish absence of secrets.
  Registry advisory audit reported zero findings for this lockfile.
- Open manual checks. Test native IME on a physical mobile device, keyboard
  and zoom in both themes, YouTube playback failures, and student and admin
  routes with actual disposable accounts. Lighthouse and authenticated
  route performance were unavailable in this pass. Stay within existing
  capacity thresholds and review provider compute and transfer separately.

The [disposable database runbook](engineering-verification.md) records
fish commands and expected outcomes. Its database concurrency test and
HTTP tests are production gates. The synthetic pre-migration fixture test
is inapplicable to the populated migrated clone. Public browser skips
from the offline suite are covered by the separate loopback run. The
authenticated long-custom browser test requires existing clone credentials,
as do three auth HTTP cases and the capacity HTTP case.

## Git preparation

Review the full accumulated diff before staging, including intentional icon
binaries. Stage explicit project paths and inspect the result.

```fish
cd (git rev-parse --show-toplevel)
git add -A -- app components lib prisma tests scripts docs .github/workflows/ci.yml
git add -- .env.example .gitignore AUDIT_TODO.md README.md next.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml
git diff --cached --check
git diff --cached --stat
git diff --cached --name-status
```

Suggested commit message: `Prepare StenoType release candidate`.
All operations above are for owner review. The active branch is
audit/fixes. CI watches main, master and audit/fixes for pushes, and repository
files do not establish Vercel production-branch or preview credentials.
Check those settings in the Vercel dashboard before any push. After
approval, push a non-production review branch only after confirming its
preview uses disposable credentials or preview builds are disabled.
