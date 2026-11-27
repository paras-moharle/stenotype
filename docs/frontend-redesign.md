# Frontend redesign tracker

- [x] Inventory the public, student and admin routes, account gates, API use, worker, clock and scoring lifecycle.
- [x] Record baseline: 202 passed, eight environment-gated skips. Record all seven migration checksums.
- [x] Design tokens, persistent themes and brand.
- [x] Public practice, about, authentication and recovery routes.
- [x] Student workspace, library, results and profile.
- [x] Admin workspace, account management, dictations, results and audit history.
- [x] Typing layout and accessible interaction.
- [ ] Build, regressions and browser verification.

## Technology

Keep Next.js App Router, TypeScript, React, Tailwind 4, Lucide, CVA and the existing Radix Slot. Native controls and dialog provide accessible defaults with little client code. A general component library such as Base UI, shadcn/ui, React Aria or Ark UI would add migration and adapter work without solving a current requirement better than native controls. CSS handles short transitions and reduced motion. Motion and a charting runtime are unnecessary for the existing data. System faces eliminate font downloads while preserving stable mono passage geometry. Public practice stays prerenderable. Protected, data-backed pages stay server-rendered where possible. No dependency or database changes are planned.

## Implemented design system

The visual identity uses a shorthand-inspired mark with an under-stroke
that recalls the typing caret. The favicon and Apple icon share the
same mark. The palette uses warm light neutrals and forest green, with
a dark graphite-green equivalent. Georgia provides editorial headings,
system sans-serif provides UI text, and system monospace sets passage
text. The app downloads no font files.

- `app/globals.css` defines semantic surfaces, text, borders, focus
  outlines, corner sizes, restrained elevation and motion. Light and
  dark styles preserve green for correct, red for incorrect and amber
  for missed feedback. The active character keeps the under-character
  caret with ink skipping disabled.
- The root starts with system theme. A pre-paint script reads a strictly
  enumerated local preference. The theme control cycles system, light
  and dark without persisting a server preference or fetching a session.
- Native modal dialogs provide focus containment and return. Shared
  workspace headings, navigation, skeletons, buttons, table presentation
  and pagination serve both roles. Public navigation remains visible at
  narrow widths. The workspace uses five compact navigation entries on
  mobile, an icon rail on tablets and a labeled rail on wide displays.
- Reduced motion applies to CSS transitions and the completion scroll.
  The scrolling typing viewport keeps its existing five-line geometry.
  No scrolling animation runs on the caret's keystroke path.

## Route coverage and data boundaries

- Public practice presents the typing controls under a short editorial
  introduction. Free practice now offers a full passage or first 30
  words. About retains its support contacts and explains both practice
  paths. Sign-in keeps the existing provider and redirect behavior.
  Public 404, retry screens, footer and loading share the design tokens.
- Student dashboard and profile retain the verified real metrics and
  account details. The searchable dictation library filters the already
  loaded metadata, and its result dialog uses the existing authorized
  request. Results switch from compact cards to a scrollable desktop
  table. They distinguish net WPM, attempted accuracy and completion.
- The new protected result-detail page performs one deliberate read
  scoped to the active student profile and result ID, with prefetch
  disabled from the history list. It displays the immutable historical
  reference or existing snapshot and the saved transcription. Unknown
  references remain unknown. It reuses the existing alignment worker
  and review renderer, and does not recompute the stored metrics.
- The admin workspace keeps real overview metrics and capacity status.
  Student management uses the existing update, block, delete and
  revoke-session operations. Dictation editing adds modal focus,
  pending-state feedback, an unsaved-changes prompt and visible draft
  length guidance. Admin results add search and completion predicates
  to the existing bounded server query. Admin login history uses the
  existing gated API, with cancellable requests and pagination.
- API handlers, scoring code, auth providers, the worker and clock,
  Prisma schema, all seven migrations and dependency manifests remain
  unchanged. No new background work, external runtime dependency or
  provider setting was introduced. The presentation integration adds
  no authentication queries to the public landing render.

## Phase record

- [x] Phases 1–4: baseline and stack choice, design system, shared
  primitives, public pages and sign-in.
- [x] Phases 5–7: student and admin layouts, all existing pages,
  scoped historical review and the typing workspace.
- [x] Phase 8: theme, reduced motion, responsive shell and dialogs.
- [x] Phase 9: shared navigation consolidated, five unused shells
  removed, system fonts, keyboard focus and bounded pagination.
- [ ] Phase 10: authenticated/browser acceptance requires the configured
  disposable database. Public visual checks and static validation are
  separate from that gate.

## Current local acceptance

Follow [Development in the README](../README.md#development) for startup.
For authenticated checks, use the isolated CI PostgreSQL service, or follow
the [disposable-branch verification guide](engineering-verification.md) with
the approved database. The workflow exercises the browser suite against a
production build. Never run test fixtures against a production database.

## Verification results

- TypeScript and ESLint pass. Turbopack built successfully. The public
  practice, About and login pages remain statically generated.
- The offline suite passed 202 checks, including scoring and worker
  parity, with nine gated skips. A separate production-build Chromium
  run passed the public geometry test and the new public viewport and
  theme test. The latter visited practice, About, sign-in and 404 at
  widths from 320 to 3840 px, including a short landscape viewport, with
  reduced motion emulated. Light and dark preferences persisted across
  reload. Public Chromium exercised typing, caret geometry and keyboard
  traversal. Authenticated long-passage browser and DB tests were not
  run with the dummy database.
- An anonymous HTTP smoke check returned 307 to sign-in for admin,
  login history, student dashboard and student result detail.
- Homepage assets referenced by the existing and new prerendered
  production HTML were counted locally. Uncompressed CSS went from
  95,258 to 74,245 bytes. Font files went from 88,912 to zero bytes.
  Initial JavaScript stayed near 722 KB raw in both builds. This is
  an artifact comparison. It excludes network scheduling, compression
  by the host, browser rendering and field performance.
- Seven migration SHA-256 checks passed. The API directory, Prisma files,
  library, scoring, clock and worker sources were compared with the
  pre-redesign checkout. No production credentials were loaded.
- Public practice screenshots were captured locally for the original review.
  Protected-route visual inspection, actual IME/mobile keyboard testing,
  production accessibility checks and field Core Web Vitals remain
  acceptance work. Passage difficulty was not assigned a synthetic
  rating. The existing topics and the new length chooser provide the
  available practice choices.

## Visual refinement and typing activation

The dark theme now uses graphite and charcoal with a lavender action
accent and a separate cool-blue focus color. Green, red and amber stay
semantic. Light colors and typefaces are unchanged. Radius tokens
range from 6 px details to 20 px surfaces.

A ready workspace takes one printable key from the unfocused document,
focuses the real input and commits that character through the same
typing path. Native input handles subsequent edits and composition.
Focused controls, shortcuts, modal dialogs, previews and completed
runs are excluded. The page never autofocuses on load. Desktop
restart and new passage actions can restore input focus. Mobile
keyboard opening remains intentional.

Production build, TypeScript and ESLint passed. The offline suite
passed 202 checks with 10 gated skips. The Chromium run passed three
public tests, including first-key capture, native IME commit, timer,
restart, form/dialog boundaries, and light/dark responsive checks.
The tested dark color pairs range from 7.42:1 to 16.02:1. The signed-in
custom typing test still needs a disposable account. The public test
does not substitute for a real device or an authenticated visual pass.

## Black theme and practice controls — historical local review

For the current passage bank and selection behavior, see [Practice content](practice-content.md).

Run development commands from the checkout you intend to review. Stop older development servers before launching the current checkout on the same port.

The current dark palette uses #090909 canvas, #141414 surfaces, #202020 menus and off-white active controls. Practice configuration uses one shared public/student toolbar. Container width determines its one-row, two-row or stacked arrangement. Radix Select provides popup positioning, typeahead and keyboard focus for the typing pickers. CSS handles the segmented indicator. This supersedes the earlier recommendation to keep those pickers native. A second primitives suite or Motion runtime would duplicate functionality here.

Free practice selects one complete original paragraph. The old bank had 45 entries across three topics. Mixed drew a topic first, and each eligible pool used a shuffle bag. The server supplied a prerendered initial passage, independent of the client bag. The 75-word target was a pool filter with 20 words of tolerance, never a truncation function. The 51-entry bank adds original legal-record, workplace and general material. Legal passages are fictional exercises. Subsequent draws consider the currently displayed passage and avoid repeats across bag refills. Restart retains the passage. New passage draws another. Neither action writes to the database.

Whole paragraphs retain a continuous topic and sentence boundaries. Combining unrelated sentences or substituting template vocabulary would reduce coherence. Offline editorial expansion remains possible. Runtime AI would add network and cost dependencies. Difficulty labels await a calibrated editorial rubric.

Both length choices derive from the same source. The short option takes exactly its first 30 whitespace-delimited words, including punctuation, and may finish mid-sentence. Full restores the complete paragraph. The five-line surface tracks the caret. A collapsed preview gives the actual word count and exposes the entire selected text before visible practice. Blind practice has no preview. A session ends on a complete matching reference, manual submit or the selected deadline, whichever occurs first. Off removes the deadline. The 15/30/60-second choices remain maximum times. Scoring and dictation storage are independent of this selection.

The runtime Prisma pg adapter upgrades Neon URL modes to verify-full while keeping CA parameters and credentials. For a custom database domain, explicitly configure verify-full on the runtime URL. The environment example uses verify-full. Keep the direct CLI/libpq URL specific to its client per the production database runbook. No live TLS handshake was performed during this frontend review.

Chromium verified the public routes under both themes, geometry, first-key capture, keyboard menu selection, full/short/full restoration and completion. Toolbar arrangement was checked at 18 widths from 320 to 3840 CSS pixels. At 800px the selected timer indicator moved from 86.25px through 157.27px to 172.5px. Computed dark body color was rgb(9,9,9), the picker radius 15px and the console radius 24px. The public checks ran with an unreachable loopback database. Authenticated acceptance still requires the disposable verification branch and student/admin sessions.
