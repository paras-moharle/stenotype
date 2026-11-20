# StenoType

A typing/stenography practice app for students. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, Better Auth, and Neon Postgres.

## Features

- **Typing practice** — Free typing, custom paste, and blind dictation modes
- **Dictation-only results** — Only dictation attempts are saved; free practice and
  custom text stay in the browser
- **Server-side scoring** — Results computed on the server, never trusted from client
- **Dictation management** — Admin uploads YouTube dictations with transcripts
- **Student tracking** — Per-dictation attempt history and progress stats
- **Admin-created accounts** — no public sign-up; an admin adds every student
- **Secure auth** — Better Auth with single-session enforcement and login audit
- **Admin controls** — Manage students and dictations, ban users, revoke sessions

## Quick start

### Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) Postgres database (free tier)

### Setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
pnpm install

# 2. Copy env template and fill in your values
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL, BETTER_AUTH_SECRET,
# BETTER_AUTH_URL, and the seed account credentials.

# 3. Create the database tables
npx prisma migrate dev

# 4. Seed the admin + student accounts
npx prisma db seed

# 5. Seed dictations
node --env-file=.env.local --import tsx prisma/seed-dictations.ts

# 6. Start the dev server
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the seed accounts from your `.env.local`.

## Environment variables

All secrets live in `.env.local` (gitignored). See `.env.example` for the full list.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Yes | App URL (`http://localhost:3000` locally) |
| `RESEND_API_KEY` | Step 7 | Email/OTP (Resend) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only | Initial admin account |
| `STUDENT_EMAIL` / `STUDENT_PASSWORD` | Seed only | Initial student account |
| `DEV_ORIGINS` | No | Extra dev-server origins (e.g. LAN IP) |

## Scripts

| Command | What it does |
|---|---|
| `pnpm run dev` | Start the dev server |
| `pnpm run build` | Production build (runs `prisma generate` first) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run tests (`tsx --test`) |
| `npx prisma migrate dev` | Create + apply a migration |
| `npx prisma db seed` | Seed admin + student accounts |
| `npx prisma studio` | Visual database browser (http://localhost:5555) |

## Free-tier posture

Everything is designed to stay inside **Neon Free** and **Vercel Hobby** —
no paid add-ons, no cron jobs, no image optimisation.

| Resource | Current | Free limit |
|---|---|---|
| Database size (`neondb`) | ~9 MB | 0.5 GB |
| Tables | 10 | — |
| DB connections per instance | 5 | — |
| Static pages | `/`, `/about`, `/login`, `/typing` | — |

How that is kept in place:

- **The home page is static.** Guest traffic never invokes a serverless
  function and never wakes the database.
- **One session read per page.** Protected layouts resolve it server-side and
  seed the client, so there is no second `/api/auth/get-session` call.
- **Dictation metadata is fetched lazily**, only when a signed-in user opens
  dictation mode.
- **Small connection pool** (5) with `allowExitOnIdle`, so Neon can suspend
  between bursts.
- **Every list is capped** (50 attempts, 100 admin rows) and attempt
  submissions are rate limited.
- **No billable services are installed** — no Vercel KV/Blob/Postgres/Edge
  Config/Analytics, no `vercel.json` cron config.
- `npm run db:check-sync` plus `tests/free-tier.test.mjs` fail the build if a
  paid SDK, cron job, image optimisation or oversized pool is introduced.

To check the database footprint at any time:

```sql
SELECT pg_size_pretty(pg_database_size('neondb'));
```

## Deploy to Vercel

### 1. Set environment variables in Vercel dashboard

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `BETTER_AUTH_SECRET` | Same as `.env.local` |
| `BETTER_AUTH_URL` | `https://your-app.vercel.app` |
| `RESEND_API_KEY` | Your Resend key (optional) |

### 2. Push to GitHub

```bash
git add -A
git commit -m "Your message"
git push
```

Vercel auto-deploys on push. The build runs `prisma generate && next build`.

### 3. Verify

- Visit your Vercel URL
- Try logging in with seed credentials
- Check that `/api/auth/get-session` returns 200 (not 404/500)

## Auth

Better Auth with email/password and DB-backed sessions. **Public sign-up is
disabled** (`lib/auth-config.ts`): accounts are created by an admin from
`/admin/students`, or by the seed script. Single active session per user (a new
sign-in revokes others). Every successful sign-in is written to the
`LoginAttempt` audit table. Admins can ban users and revoke sessions.

## Project structure

```
app/            Next.js App Router pages + API routes
components/     React components (admin, student, typing, ui)
lib/            Auth, DB, scoring engine, schemas, utilities
prisma/         Prisma schema, migrations, seed
tests/          Test files (tsx --test)
```

