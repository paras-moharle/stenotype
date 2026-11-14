# StenoType

A focused typing-practice web app for stenography students. The home page
**is** the typing test — no marketing, no chrome: a passage is on screen
immediately, the timer starts on your first keystroke.

## Current state (preview build)

**Works:**
- Typing-first home page (Monkeytype-style): free practice with category
  (Legal / Professional / General / Mixed) and duration (15/30/60s) pills
- Honest scoring — per-character, no cascade; **errors never disappear**
  when you backspace; 5-char-standard Gross/Net WPM + accuracy
- Auto-submit when the final word is typed (trailing punctuation optional),
  Submit button any time, `Tab` restarts, passages are always 50–100 words
- Custom mode — paste your own text (min 40 chars) via a dedicated dialog;
  paste is blocked inside the test itself (no cheating)
- Student area — dictation (blind typing with word-by-word diff), results
  (session-only, max 5, cleared on refresh), profile
- Auth — env-based accounts (2 users, no signup), HMAC HttpOnly cookie,
  4-hour sessions, single active session per account, admin kill-switch
  (`POST /api/admin/disable-session`), login rate limiting (5 tries / 15 min)
- `proxy.ts` gates `/student/*` and `/admin/*` server-side

**Deliberately not built yet ("under progress" in the UI):**
- Database persistence (results are session-only until then)
- Dictation audio — being rebuilt around YouTube thumbnails + transcripts
- Admin content management (all admin pages are mock/local-state only)

## Stack

Next.js 16 (App Router), React 19, Tailwind v4, TypeScript, Zod.
No ORM connected yet — `prisma/schema.prisma` sketches the future data model.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
```

### Required environment variables (`.env`, gitignored)

```
AUTH_SECRET=<random 32+ bytes>
ADMIN_EMAIL=<paras' login email>
ADMIN_PASSWORD=<strong password>
STUDENT_EMAIL=<abhijeet's login email>
STUDENT_PASSWORD=<strong password>
```

Auth **fails loudly** if any of these are missing — there are no demo
fallback credentials.

## Deploy

Vercel (native Next.js + Node runtime API routes). Set the env vars above in
the project settings. Do **not** set `DATABASE_URL` yet.
