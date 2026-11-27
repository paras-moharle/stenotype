# StenoType

StenoType is a typing and stenography practice workspace for students and the administrators who prepare their exercises. It supports short daily drills, practice with your own passages, and blind transcription from YouTube recordings. It is a practice platform without formal examination features.

## What you can do

- **Free typing.** Practice with curated general, professional and legal passages. Choose a timed run, the first 30 words, or an untimed full passage.
- **Custom typing.** Signed-in users can apply their own text and keep it visible or practice in Blind mode. Free and Custom attempts stay in the active browser session and are never saved as historical results.
- **Dictation.** Students can browse published exercises, open YouTube externally, read the transcript for study, open past results, or start the exact exercise in Blind mode. The typing workspace hides the reference until evaluation. YouTube controls playback independently.
- **Results.** Evaluated dictation attempts can be saved and reviewed against their historical reference. Attempted accuracy measures the items evaluated. Completion measures passage coverage.
- **Administration.** Administrators manage students, account status, sessions, dictation transcripts and publication. Login auditing is best-effort and may be suspended by capacity protection.
- **Responsive workspace.** The public site and workspaces support light and dark themes and adapt to phones, tiled windows and desktops.

## Architecture

Next.js App Router and React provide the public site and role-specific workspaces. TypeScript and Tailwind CSS support the application and shared UI. Better Auth handles sign-in and database-backed sessions. Prisma connects to PostgreSQL on Neon. Passage selection happens locally after the necessary content is loaded, and a worker handles browser alignment. Dictation evaluation and persistence are server-authoritative.

| Path | Responsibility |
| --- | --- |
| `app/` | Public, student and admin routes and API handlers |
| `components/` | Workspace, typing, results and shared UI |
| `lib/` | Authorization, database services, passage content and scoring |
| `prisma/` | Schema, migration history and disposable seed commands |
| `scripts/`, `tests/`, `docs/` | Operational tooling, regressions and runbooks |

Public pages can be prerendered while the client still checks session status. Authorization is enforced on protected server routes and APIs.

## Development

Use Node.js **22.12 or later in the 22.x line**, or **24 or later**, and pnpm **12.19.0**. CI uses Node 24. Development uses an approved, fully migrated disposable Neon database. Use existing disposable accounts.

1. Create a private environment file without replacing an existing one:

   ```fish
   test -e .env.local; or install -m 600 .env.example .env.local
   ```

2. Edit `.env.local` privately. Set `DATABASE_URL` to the approved direct disposable connection, `BETTER_AUTH_URL=http://localhost:3000`, and a local-only `BETTER_AUTH_SECRET` generated with `openssl rand -hex 32`. Remove conflicting shell exports. Keep credentials out of Git.
3. Install and start:

   ```fish
   pnpm install --frozen-lockfile
   and pnpm dev
   ```

Installation generates the Prisma client and requires a datasource URL in the environment. Development startup verifies the database target, TLS, migration ledger and key schema requirements. Startup never migrates or seeds. For direct LAN access, configure an explicit trusted origin and bind address. For an HTTPS tunnel, use its exact public origin as `BETTER_AUTH_URL` and restart. The canonical HTTPS origin enables secure session cookies.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Preflight and development server |
| `pnpm typecheck`, `pnpm lint` | Static checks |
| `pnpm test` | Offline regressions, with integration tests gated |
| `pnpm build`, `pnpm start` | Generate Prisma and build, then serve production output |
| `pnpm test:smoke`, `pnpm test:ui` | HTTP and Chromium verification with the documented environment |
| `pnpm db:check-sync`, `pnpm db:verify` | Schema drift and integrity checks against an explicitly selected database |

## Verification and release

GitHub Actions uses an isolated PostgreSQL service for migrations and authenticated tests. It also checks the production build, Chromium, capacity rejection, dependency advisories and secrets. Use the [verification guide](docs/engineering-verification.md) for local integration setup.

Production requires a managed HTTPS origin, an independent authentication secret, and a database with the complete migration history. Verify branch and database isolation for previews before pushing. Follow the [production runbook](docs/production-database-release.md) for the coordinated database and application cutover. The [promotion assessment](docs/database-promotion-assessment.md) documents a conditional alternative to migrating the original branch.

Provider plans, storage and compute are finite. Review [capacity assumptions](docs/neon-free-capacity.md), [practice content and timing](docs/practice-content.md), and [result semantics](docs/result-review-verification.md) for operational detail.
