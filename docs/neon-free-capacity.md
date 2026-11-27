# Neon Free operating limits and projections

Neon's current Free limits are 1 GB of PostgreSQL storage and 100
CU-hours per project per month, 5 GB of public transfer per project
per month, and 10 branches per project. Organization-wide PostgreSQL
storage is capped at 20 GB. Free computes suspend after 5 idle minutes.
Compute and transfer exhaustion can suspend service until the next
billing period. Storage exhaustion can reject writes. StenoType has
no path to change the plan. [Neon plan limits](https://neon.com/docs/introduction/plans)

## What is measured

The owner reported PostgreSQL 18.7 and a migration size change from
8,768 to 8,856 KiB. The 28 KiB compressed backup does not estimate online
storage. At 2,000 attempts with 309-byte mean typed text and a 276-byte
shared reference, the copied-reference layout used 1,761,280 bytes and
the shared-reference layout 1,400,832 bytes, saving 360,448 bytes
(20.47%). A unique short passage per attempt may increase overhead.
Known snapshots share the exact text. Unknown legacy references remain
unknown. Three small-clone SQL plans executed at 0.113, 0.055 and 0.039 ms
for admin recent, student history and published catalog respectively.

These measurements do not include connection, cold-start, application
or network latency. No representative production workload, compute bill
or egress was measured. Neon project accounting covers branch and
history usage beyond the SQL database-size signal. Treat the planning
model below as a conservative starting point and revisit after the first
full month. Watch the Console at least weekly and before cutover
without adding polling from the application. Use approximately 80
CU-hours and 4 GB public egress as operating alerts, with room for
backups and verification. A sustained open activity window can exhaust
compute despite excellent SQL execution times. Review bulk history
reads and backups if transfer grows. No upgrade is automated.

## Planning model

Use decimal MB. These are assumptions for initial enrollment planning.

- **2.5 KB per attempt**, including typed text, score snapshot, digest,
  indexes and overhead allowance. Typed passages approaching the input
  cap, unique references, or elevated bloat can exceed this.
- **2 KB per enrolled student** as an initial budget for user, profile,
  account and current session. Add about **100 KB per student-month**
  for 2 attempts on each of 20 active days. Add **12 KB per student-month**
  for one login per active day at 0.6 KB per audit row.
- **35 KB DB egress per active student-day**, assuming modest dashboard and
  history reads plus 2 submissions. Full histories, repeated transcript
  return on replay, TLS/protocol overhead, exports and verification
  variants can change this. YouTube media does not come from Neon.
- Compute scenarios assume the marked number of awake hours per day at
  0.25 CU over 30 days, including the idle tail. Even low transaction
  rates can keep an endpoint awake if spaced closely. Double these
  figures at 0.5 CU average. All branch compute shares the project budget.

| Students | Attempts per active day | Attempt MB per active day / month | 30 / 90 / 365 day attempt MB | One month audit MB | Monthly egress MB | Awake h/day → CU-h/month |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 100 | 0.25 / 5 | 5 / 15 / 60 | 0.6 | 35 | 2 → 15 |
| 100 | 200 | 0.50 / 10 | 10 / 30 / 120 | 1.2 | 70 | 4 → 30 |
| 250 | 500 | 1.25 / 25 | 25 / 75 / 300 | 3 | 175 | 6 → 45 |
| 500 | 1,000 | 2.50 / 50 | 50 / 150 / 600 | 6 | 350 | 10 → 75 |
| 1,000 | 2,000 | 5.00 / 100 | 100 / 300 / 1,200 | 12 | 700 | 16 → 120 |

Add the database baseline, shared reference storage, enrollment overhead,
logs, indexes, bloat and migration headroom. Audit MB is cumulative if
retention stays disabled. For example at 500 students one year is about
600 MB of attempts and 72 MB of login events before the baseline and
other overhead. At 1,000, attempts alone exceed the annual Free storage
cap in this scenario. A 100 CU-hour project allows at most 400 awake
hours per month at 0.25 CU, about 13.3 hours per day. Holding usage below
80 CU-hours for headroom reduces that to about 10.7 hours per day.

A conservative initial planning band is 50–250 active students at the
assumed workload, then reassess monthly with actual usage. A 500-student
rollout needs measured compute headroom and a known history growth rate.
A 1,000-student rollout needs a lower per-student persisted workload or a
separately approved retention policy, and a demonstrated compute
schedule. These are planning bands for active workload, not account
limits. Keep enrollment and high-volume sessions under manual review
once project usage reaches 70%. Free and custom practice keep working
locally without storing results.

## Growth policy and controls

- The application samples PostgreSQL storage on demand, caches it per
  instance for five minutes by default, and takes the higher of that
  percentage and the optional manually supplied Neon project percentage.
  On cold instances more than one sample can occur. This is an advisory
  headroom guard with concurrent overshoot, not a hard storage quota.
  Check Neon Console separately and keep the configured SQL budget
  conservative when other branches or migration copies are active.
- **50%** displays a warning on the admin overview. **70%** asks for urgent
  review. **80%** pauses new stored attempts, new dictations, transcript
  edits, new accounts and optional login audit inserts. Existing attempt
  replay, sign-in, sign-out, views, revocation and operational maintenance
  remain available subject to remaining provider resources. An unsaved
  result returns HTTP 503 and the typing client retains the text for
  retry in the current tab. There is no writing retry on a background
  schedule and no paid upgrade path.
- Ordinary traffic occasionally prunes up to 100 expired sessions and
  100 expired quota windows per run. There is no cron wake-up. The time
  gate is per process. Concurrent workers skip locked rows. If no
  traffic comes in, cleanup also stays idle. Quota checks require an
  atomic database update to share budgets across instances. The
  application keeps those off session reads, logout and local practice.
- Recommend **30 days of login audit events** if the owner approves.
  This preserves a recent operator window while limiting stored PII.
  Defaults keep all events. `DB_LOGIN_RETENTION_DAYS=30` opts in and
  prunes at most 100 per batch. Audit insert stores a bounded user agent.
  The email snapshot has independent value after user deletion.
- **Detailed attempt history remains indefinite** until explicitly
  approved. Review a 365-day detail policy only if the measured volume
  warrants it. Before any approved purge or archive transfer, add and
  reconcile compact per-student lifetime count, sum WPM, sum accuracy
  and maximum WPM, with a deterministic cutoff and retry-safe accounting.
  Keep auditability of transcript versions and explicitly decide
  whether typed text may be removed. No detail-purge path exists.
- **Legacy archive and official references remain retained**. The
  archive may contain typed text. Choose explicit operator-access and
  retention rules. No automatic deletion or compaction runs. Ordinary
  row deletion can leave space reusable within PostgreSQL without
  immediately shrinking provider usage. Avoid routine full rewrites
  because they require headroom and locks.

## Access path review

- Server-rendered student pages share request-cached identity and active
  profile resolution. Browser API calls still authorize separately.
  Cookie caching remains disabled so session revocation takes effect.
- Attempt submission does a scoped replay read, capacity gate when the
  sample is stale, cross-instance quota update, narrow reference lookup,
  and a transaction to insert the shared reference if absent and write
  the score. Conflicting attempt keys replay the saved result, including
  the original transcript. Review this cost under actual concurrency
  before trading transaction integrity for fewer operations.
- Admin dictation listings omit transcripts. The student catalog keeps
  only metadata. History pages select bounded numeric fields and use
  existing student recency and dictation lookup indexes. Global result
  order, published catalog order, and filters need measured plans before
  adding or dropping indexes. Elapsed time, final typed text and saved
  score remain for reproducibility. No intermediate input state is
  written.
- Retain the five-connection per-instance pool and use the pooled Neon
  endpoint for serverless runtime if measured connections require it.
  Use the direct endpoint for migrations and backups. Keep app and DB
  regions aligned. No capacity polling, background connection, or
  keepalive is added. Use the Console to track **project** CU-hours and
  egress and to spot query activity preventing suspend.
