# Practice content and selection

The former selector shipped 51 short paragraphs and its shuffle bags with
the typing client. The new content modules under lib/passages hold 66
original practice pieces, including 15 additions. The new exercises cover
subjects such as exhibits and translation, municipal projects and document
retention, astronomy and community repair. Legal exercises are fictional.
They are training material and make no claim to an official provenance.

| Category | Sources | Word range | Easy | Standard | Advanced |
| --- | ---: | ---: | ---: | ---: | ---: |
| Legal | 22 | 60–209 | 2 | 14 | 6 |
| Professional | 22 | 62–212 | 3 | 12 | 7 |
| General | 22 | 67–226 | 12 | 9 | 1 |

Each category added two medium and three long sources. Difficulty metadata
counts several independently observable features, including long-word share,
sentence length, punctuation density, abbreviations and digits. It is a
heuristic without learner calibration. It does not appear as a filter.
Automated lexical comparison guards against close repeats. It cannot assess
whether two different passages make the same point.

## Practice formats

- **Full passage, Off** uses the complete original source.
- **Full passage, 15/30/60s** takes a continuous opening excerpt ending at the
  first sentence boundary at or after 300/600/1,200 normalized characters.
  This provides 20% headroom compared with 200 standardized WPM. Matching
  the entire reference can still finish early.
- **First 30 words** is untimed. Returning to Full restores the previous
  reference for the selected duration. Restart preserves the source.
  New passage deliberately changes it.

The system selects a new eligible source only when a duration change needs
more text than the current source supplies. Category changes load a source
from the new category. The typing reference remains fixed during an active
attempt. Existing scoring and persistence rules apply.

The longest sources are well below the alignment guard of 20,000 normalized
characters and 26 million cells. Every source plus the allowed extra input is
validated against the latter. Longer timers and a difficulty filter would
reduce eligible variety given the current bank, so the toolbar retains its
existing controls.

## Rotation and delivery

The server selects and renders the first source. All subsequent selections
happen in the browser. It asynchronously imports the category it chooses
and reuses the loaded module. The 18-entry local history stores passage IDs
only. If the pool runs out, the least recently used alternative is selected.
Mixed rotates least recently used categories. Disabled or malformed storage
falls back to in-memory selection. The first prerendered passage can repeat
on reload. It stays in place through hydration and is recorded so subsequent
draws can move away from it. Unloaded category chunks need access to the
app's static assets. A load error leaves the existing source available.

Curated sources and continuous excerpts retain topic and grammar. Random
sentence assembly or template generation would trade away that coherence.
Offline assisted drafts could expand variety with editorial checking, while
runtime generation would add unnecessary external dependencies. This release
ships 66 sources, below the 300-source stretch goal. At 60 seconds the
pool has three alternatives per category and eventually repeats.

## Measured performance

The same production HTML script-source count before and after found 14
initial scripts. Their combined size fell from 803,932 to 783,217 bytes raw
and from 256,923 to 247,934 bytes when gzipped independently. The three
category chunks were outside that initial script list and were 12.3–13.7 KB
raw or 5.3–5.8 KB gzip each. The public page remains ISR.

A local Node run averaged 0.013 ms per warmed selection across 3,000 calls.
A representative near-identical 1,264-character comparison took 0.224 ms
median in the shared alignment function. These are local microbenchmarks.
They exclude worker messaging, cold download, DOM rendering and real-device
latency.

## Local verification in fish

```fish
cd (git rev-parse --show-toplevel)
pnpm typecheck
pnpm lint
pnpm test
env DATABASE_URL=postgresql://localhost:1/offline BETTER_AUTH_URL=http://127.0.0.1:3192 pnpm build
env DATABASE_URL=postgresql://localhost:1/offline BETTER_AUTH_URL=http://127.0.0.1:3192 pnpm start -H 127.0.0.1 -p 3192
```

In a separate terminal:

```fish
cd (git rev-parse --show-toplevel)
env STENO_E2E_URL=http://127.0.0.1:3192 pnpm test:ui
```

For authenticated and database checks use the existing disposable-branch
procedure in [engineering verification](engineering-verification.md).
