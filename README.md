# StenoType

A typing/stenography practice app for students. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 7, Better Auth, and Neon Postgres.

## Quick start

### Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) Postgres database (free tier)

### Setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
npm install

# 2. Copy env template and fill in your values
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL, BETTER_AUTH_SECRET,
# BETTER_AUTH_URL, and the seed account credentials.

# 3. Create the database tables
npx prisma migrate dev

# 4. Seed the admin + student accounts
npx prisma db seed

# 5. Start the dev server
npm run dev
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
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run tests (`tsx --test`) |
| `npx prisma migrate dev` | Create + apply a migration |
| `npx prisma db seed` | Seed admin + student accounts |

## Auth

Better Auth with email/password and DB-backed sessions. Single active session per user (a new sign-in revokes others). Every successful sign-in is written to the `LoginAttempt` audit table. Admins can ban users and revoke sessions via the Better Auth admin plugin.

## Project structure

```
app/            Next.js App Router pages + API routes
components/     React components (admin, student, typing, ui)
lib/            Auth, DB, scoring engine, schemas, utilities
prisma/         Prisma schema, migrations, seed
tests/          Test files (tsx --test)
```

