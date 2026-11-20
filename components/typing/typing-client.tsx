'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  X,
  Headphones,
  Eye,
  EyeOff,
  Sparkles,
  ClipboardPaste,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import {
  align,
  buildLiveChars,
  splitMissedNotReached,
  buildReferenceDisplayItems,
  buildTokenDisplayItems,
  countScoredWords,
  formatClock,
  MAX_ALIGN_CHARS,
  MAX_CUSTOM_CHARS,
  normalizeText,
  scoreFromAlignment,
  type AlignmentResult,
  type ScoreResult,
  type TokenDiffEntry,
} from '@/lib/typing/scoring';
import { generatePassage } from '@/lib/passage-generator';
import {
  inspectCustomText,
  MIN_CUSTOM_WORDS,
} from '@/lib/typing/custom-text';
import {
  acceptsInput,
  countsAsRecorded,
  persistsAttempt,
  typedCharCap,
  usesAnchoredAutoFinish,
} from '@/lib/typing/mode-rules';
type TestState = 'idle' | 'running' | 'complete';
type Duration = 15 | 30 | 60;
type Category = 'mixed' | 'Legal' | 'Professional' | 'General';
type Mode = 'free' | 'dictation' | 'custom';

const DURATIONS: Duration[] = [15, 30, 60];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Professional', label: 'Professional' },
  { value: 'General', label: 'General' },
];

export type TypingClientProps = {
  variant?: 'public' | 'student';
  initialMode?: Mode;
  initialDictationId?: string;
};

export default function TypingClient({
  variant = 'public',
  initialMode = 'free',
  initialDictationId,
}: TypingClientProps) {
  const showModes = variant === 'student';
  const isPublic = variant === 'public';
  const router = useRouter();

  // Auth state comes from the shared provider. On protected pages it is
  // server-seeded, so this is known on first paint; on the public home
  // it resolves once and unlocks the member tabs.
  const { isAuthenticated: authenticated } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [duration, setDuration] = useState<Duration>(30);
  const [category, setCategory] = useState<Category>('mixed');

  // Dictations fetched from API (metadata only, no transcripts).
  // Transcripts are fetched server-side during scoring.
  type DictationMeta = {
    id: string;
    title: string;
    category: string;
    youtubeId: string | null;
    durationSeconds: number | null;
  };
  const [dictations, setDictations] = useState<DictationMeta[]>([]);
  const [dictationsState, setDictationsState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [dictationId, setDictationId] = useState(initialDictationId ?? '');
  const [dictationTranscript, setDictationTranscript] = useState('');

  // Dictation metadata is fetched only when dictation is actually
  // opened. It used to fire on every visit — including free practice and
  // signed-out guests, where the request can only return 401.
  useEffect(() => {
    if (mode !== 'dictation') {
      // Allow a retry next time the mode is entered.
      if (dictationsState === 'error') setDictationsState('idle');
      return;
    }
    if (isPublic && !authenticated) return;
    if (dictationsState !== 'idle') return;

    setDictationsState('loading');

    fetch('/api/dictations')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        setDictations(data.dictations);
        if (data.dictations.length > 0) {
          setDictationId((current) => current || data.dictations[0].id);
        }
        setDictationsState('ready');
      })
      .catch(() => setDictationsState('error'));
  }, [mode, isPublic, authenticated, dictationsState]);

  const dictation = dictations.find((item) => item.id === dictationId) ?? {
    id: '',
    title: 'No dictation selected',
    category: 'GENERAL',
    youtubeId: null,
    durationSeconds: null,
  };

  const [customText, setCustomText] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customBlind, setCustomBlind] = useState(false);
  const [passage, setPassage] = useState('');

  const [typed, setTyped] = useState('');
  const [state, setState] = useState<TestState>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(0);
  const [showReference, setShowReference] = useState(true);
  const [blindConfirm, setBlindConfirm] = useState<null | 'enable' | 'disable'>(
    null
  );
  const [runBlind, setRunBlind] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [peekedThisRun, setPeekedThisRun] = useState(false);
  // Dictation has no local reference until the server scores it, so the
  // result panel waits on this flag instead of rendering an empty review.
  const [awaitingScore, setAwaitingScore] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreRetry, setScoreRetry] = useState(0);

  useEffect(() => {
    if (isPublic && !authenticated && mode !== 'free') {
      setMode('free');
      setTyped('');
      setShowReference(true);
      setRunBlind(false);
      setCustomText('');
      setCustomInput('');
      setStartedAt(null);
      setFinishedAt(null);
      setClockNow(0);
      setState('idle');
    }
  }, [isPublic, authenticated, mode]);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);
  const recordedRef = useRef(false);
  const typedRef = useRef('');
  const referenceVisibleRef = useRef(true);
  const peekedRef = useRef(false);
  const peekingRef = useRef(false);
  const previousCategoryRef = useRef<Category>(category);

  const freshPassage = useCallback(
    (selectedCategory: Category) =>
      generatePassage({
        category: selectedCategory,
        targetWords: 75,
      }),
    []
  );

  const reference = useMemo(() => {
    if (mode === 'dictation') {
      if (isPublic && !authenticated) return '';
      return dictationTranscript; // Populated after scoring for review.
    }

    if (mode === 'custom') {
      if (isPublic && !authenticated) return '';
      return customText;
    }

    return passage;
  }, [mode, dictationTranscript, customText, passage, isPublic, authenticated]);

  useEffect(() => {
    if (mode === 'free' && !passage) {
      setPassage(freshPassage(category));
    }
  }, [mode, passage, category, freshPassage]);

  useEffect(() => {
    if (previousCategoryRef.current === category) return;
    previousCategoryRef.current = category;

    if (mode !== 'free' || state !== 'idle') return;

    setPassage(freshPassage(category));
    setTyped('');
    typedRef.current = '';
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
  }, [category, mode, state, freshPassage]);

  useEffect(() => {
    setTyped('');
    typedRef.current = '';
    setState('idle');
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);

    // Switching dictation must not keep the transcript fetched for the
    // previous one — otherwise an earlier review leaks into this run.
    setDictationTranscript('');

    if (mode === 'free') {
      setShowReference(true);
    } else if (mode === 'dictation') {
      setShowReference(false);
    } else if (mode === 'custom' && customBlind) {
      setShowReference(false);
    } else {
      setShowReference(true);
    }

    requestAnimationFrame(() => inputRef.current?.focus());
    // Category changes are intentionally handled separately.
  }, [mode, dictationId, customText, customBlind]);

  useEffect(() => {
    setTyped('');
    typedRef.current = '';
    setState('idle');
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [duration]);

  const timed = mode === 'free';

  useEffect(() => {
    if (state !== 'running') return;

    setClockNow(Date.now());
    const id = setInterval(() => setClockNow(Date.now()), 250);

    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (state !== 'running' || !timed || startedAt === null) return;

    const deadline = startedAt + duration * 1000;
    const check = () => {
      if (Date.now() >= deadline) {
        setFinishedAt((previous) => previous ?? deadline);
        setState('complete');
      }
    };

    check();

    const id = setInterval(check, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [state, timed, startedAt, duration]);

  const finish = useCallback((at?: number) => {
    setFinishedAt((previous) => previous ?? at ?? Date.now());
    setState('complete');
  }, []);

  useEffect(() => {
    if (state !== 'running' || !usesAnchoredAutoFinish(mode, reference.length)) {
      return;
    }

    const normalizedTyped = normalizeText(typed);
    if (
      normalizedTyped.length > 0 &&
      normalizedTyped === normalizeText(reference)
    ) {
      finish();
    }
  }, [typed, state, mode, reference, finish]);

  const manualSubmit = useCallback(() => {
    if (state === 'running') finish();
  }, [state, finish]);

  useLayoutEffect(() => {
    if (state !== 'running' || !currentCharRef.current) return;

    currentCharRef.current.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    });
  }, [typed, state]);

  useEffect(() => {
    if (!reference || state !== 'idle') return;

    requestAnimationFrame(() => {
      typingAreaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [mode, dictationId, customText, category]);

  useEffect(() => {
    if (state !== 'complete') return;

    requestAnimationFrame(() => {
      const target =
        showModes && !showReference
          ? typingAreaRef.current
          : resultRef.current;

      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [state, showModes, showReference]);

  const composingRef = useRef(false);
  const compositionStartRef = useRef('');

  const startIfIdle = useCallback(() => {
    if (state !== 'idle') return;

    const now = Date.now();
    setState('running');
    setStartedAt(now);
    setClockNow(now);
    setFinishedAt(null);
    setRunBlind(!referenceVisibleRef.current && !peekedRef.current);
  }, [state]);

  const commitTyped = useCallback(
    (next: string) => {
      // Dictation types against a hidden reference — it only needs a
      // selected dictation, not local text.
      if (!acceptsInput({ mode, referenceLength: reference.length, dictationId })) {
        return;
      }

      // Clamp to the engine cap so align() never throws and a held key
      // cannot produce an unscoreable payload.
      const value = next.slice(
        0,
        typedCharCap(reference.length, MAX_ALIGN_CHARS)
      );
      startIfIdle();

      typedRef.current = value;
      setTyped(value);
    },
    [mode, reference, dictationId, startIfIdle]
  );

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (state === 'complete') return;

    commitTyped(event.target.value);
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
    compositionStartRef.current = typedRef.current;
  };

  const handleCompositionEnd = (
    event: React.CompositionEvent<HTMLInputElement>
  ) => {
    composingRef.current = false;
    if (state === 'complete') return;

    commitTyped(event.currentTarget.value);
    compositionStartRef.current = '';
  };

  const restart = useCallback(() => {
    setTyped('');
    typedRef.current = '';
    setState('idle');
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
    setRunBlind(false);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    setAwaitingScore(false);
    setScoreError(null);
    // A fresh dictation run must be re-scored from the transcript the
    // server holds, not the one fetched for the previous review.
    if (mode === 'dictation') setDictationTranscript('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [mode]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Dictation has no auto-finish (no local reference) and is not
      // timed, so Enter is the natural way to submit.
      if (state === 'running') manualSubmit();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      restart();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  useEffect(() => {
    if (state === 'complete') return;
    if (!acceptsInput({ mode, referenceLength: reference.length, dictationId })) {
      return;
    }

    const isEditableTarget = (element: Element | null): boolean => {
      if (!element) return false;

      const tag = element.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true;
      }

      return (element as HTMLElement).isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (isEditableTarget(document.activeElement)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (state !== 'idle' && state !== 'running') return;

      if (peekingRef.current) {
        setPeeking(false);
        peekedRef.current = true;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();

        if (typedRef.current.length > 0) {
          commitTyped(typedRef.current.slice(0, -1));
        }

        inputRef.current?.focus();
        return;
      }

      if (
        event.key.length !== 1 ||
        event.key === '\n' ||
        event.key === '\t'
      ) {
        return;
      }

      event.preventDefault();
      commitTyped(typedRef.current + event.key);
      inputRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, mode, reference, dictationId, commitTyped]);

  // Mirrors for global keyboard handlers.
  // eslint-disable-next-line react-hooks/refs
  typedRef.current = typed;
  // eslint-disable-next-line react-hooks/refs
  referenceVisibleRef.current = showReference;
  // eslint-disable-next-line react-hooks/refs
  peekingRef.current = peeking;

  const elapsedMs = useMemo(() => {
    if (startedAt === null) return 0;

    const end = finishedAt ?? clockNow;
    return Math.max(0, end - startedAt);
  }, [startedAt, finishedAt, clockNow]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  // align() throws RangeError if inputs exceed MAX_ALIGN_CHARS or
  // the DP budget. The clamp in commitTyped prevents this, but
  // guard anyway so a pathological input degrades to "all wrong"
  // instead of white-screening the page.
  const alignment = useMemo(() => {
    try {
      return align(reference, typed);
    } catch {
      return align(reference, '');
    }
  }, [reference, typed]);

  const score: ScoreResult = useMemo(
    () => scoreFromAlignment(alignment, elapsedMs),
    [alignment, elapsedMs]
  );

  const liveChars = useMemo(
    () => buildLiveChars(reference, typed),
    [reference, typed]
  );

  // Once finished, colour the passage from the SAME token alignment as
  // the result table. The live indicator is positional, so a single
  // missed character shifts every colour after it and the screen
  // disagrees with the table.
  const resultChars = useMemo(
    () => buildReferenceDisplayItems(score.alignment),
    [score.alignment]
  );

  const newFreePassage = useCallback(() => {
    setPassage(freshPassage(category));
    setTyped('');
    typedRef.current = '';
    setState('idle');
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
    setRunBlind(false);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [category, freshPassage]);

  const applyBlindMode = useCallback(
    (blind: boolean) => {
      if (isPublic && !authenticated) return;

      setShowReference(!blind);
      if (mode === 'custom') setCustomBlind(blind);
      setBlindConfirm(null);
      setTyped('');
      typedRef.current = '';
      setState('idle');
      setStartedAt(null);
      setFinishedAt(null);
      setClockNow(0);
      setRunBlind(false);
      setPeeking(false);
      peekedRef.current = false;
      setPeekedThisRun(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [isPublic, authenticated, mode]
  );

  const peekAtReference = useCallback(() => {
    setPeeking(true);
    setPeekedThisRun(true);
    peekedRef.current = true;
    setTyped('');
    typedRef.current = '';
    setState('idle');
    setStartedAt(null);
    setFinishedAt(null);
    setClockNow(0);
    setRunBlind(false);
  }, []);

  const stopPeeking = useCallback(() => {
    setPeeking(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const applyCustom = () => {
    if (isPublic && !authenticated) return;

    const check = inspectCustomText(customInput);
    if (!check.ok) return;

    setCustomText(check.text);
    setCustomInput('');
    setShowCustomDialog(false);
    setMode('custom');
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  useEffect(() => {
    if (state !== 'complete') {
      if (recordedRef.current) {
        recordedRef.current = false;
        setAwaitingScore(false);
        setScoreError(null);
      }
      return;
    }

    if (
      recordedRef.current ||
      !persistsAttempt({ mode, dictationId })
    ) {
      return;
    }
    recordedRef.current = true;

    // ── Server-side scoring (dictation only) ────────────
    // Only dictation results are stored, so this runs for dictation
    // alone. The server owns the score, completion and attempt id;
    // the client sends only what it typed and how long it took.
    const submitToServer = async () => {
      setAwaitingScore(true);
      setScoreError(null);

      try {
        const res = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passageId: dictationId,
            typed,
            elapsedMs,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Set transcript for review display (sent by server after scoring).
          if (data.reference) {
            setDictationTranscript(data.reference);
          }
          setScoreError(null);
          return;
        }

        const payload = await res.json().catch(() => null);
        setScoreError(
          payload?.error ?? 'Could not score this attempt. Please try again.'
        );
      } catch {
        setScoreError('Could not reach the scoring service. Please try again.');
      } finally {
        setAwaitingScore(false);
      }
    };

    submitToServer();
    // typed and duration are captured in the closure when state
    // becomes 'complete' — they don't need to trigger re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    reference,
    mode,
    dictation,
    dictationId,
    category,
    score,
    elapsedMs,
    runBlind,
    scoreRetry,
  ]);

  const isFinished = state === 'complete';
  const isBlind = !showReference;
  const isPeeking = showModes && peeking && isBlind;
  // Only dictation is persisted, so only a blind, scored dictation can
  // honestly be called "counted".
  const isCounted = countsAsRecorded({
    mode,
    dictationId,
    finished: isFinished,
    blind: runBlind,
    scored: score.scored,
  });
  const hasReference = reference.length > 0;
  const canType = acceptsInput({
    mode,
    referenceLength: reference.length,
    dictationId,
  });
  const passageClass = cn(
    'mx-auto w-full max-w-5xl flex-1 whitespace-pre-wrap break-words font-mono',
    isPublic
      ? 'text-2xl leading-[2] sm:text-3xl sm:leading-[2.1]'
      : 'text-xl leading-[1.8] sm:text-2xl sm:leading-[1.9] lg:text-[1.625rem]'
  );
  const timeDisplay = formatClock(
    timed ? Math.max(0, duration - elapsedSec) : elapsedSec
  );

  const wordsTyped = (text: string) => countScoredWords(text);

  const incorrectWords = score.words.incorrect;

  return (
    <div className="space-y-3 sm:space-y-4">
      {isPublic && (
        <section
          className="space-y-2.5 sm:space-y-3"
          aria-label="Typing test settings"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Sparkles className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand sm:text-[10px]">
                  A quick typing break
                </p>
                <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Find your flow<span className="text-brand">.</span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div
              className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-fit"
              role="tablist"
              aria-label="Typing mode"
            >
              <ModeTab
                compact
                active={mode === 'free'}
                onClick={() => {
                  if (isBlind) setShowReference(true);
                  setMode('free');
                }}
                icon={Sparkles}
                label="Free"
              />

              {authenticated ? (
                <ModeTab
                  compact
                  active={mode === 'dictation'}
                  onClick={() => setMode('dictation')}
                  icon={Headphones}
                  label="Dictation"
                />
              ) : (
                <ModeTab
                  compact
                  active={false}
                  onClick={() => router.push('/login')}
                  icon={Headphones}
                  label="Dictation"
                  locked
                />
              )}

              {authenticated ? (
                <ModeTab
                  compact
                  active={mode === 'custom'}
                  onClick={() => {
                    if (!customText) setShowCustomDialog(true);
                    else setMode('custom');
                  }}
                  icon={ClipboardPaste}
                  label="Custom"
                />
              ) : (
                <ModeTab
                  compact
                  active={false}
                  onClick={() => router.push('/login')}
                  icon={ClipboardPaste}
                  label="Custom"
                  locked
                />
              )}
            </div>

            {mode === 'free' && (
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="min-w-0 flex-1 sm:flex-none">
                  <label htmlFor="mobile-passage-category" className="sr-only">
                    Passage topic
                  </label>
                  <select
                    id="mobile-passage-category"
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as Category)
                    }
                    className="h-9 w-full rounded-md bg-transparent px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:hidden"
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <div
                    className="hidden items-center gap-0.5 sm:flex"
                    role="group"
                    aria-label="Passage category"
                  >
                    {CATEGORIES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setCategory(item.value)}
                        aria-pressed={category === item.value}
                        className={cn(
                          'min-h-8 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                          category === item.value
                            ? 'bg-brand text-brand-foreground'
                            : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <span
                  className="h-5 w-px shrink-0 bg-border/60"
                  aria-hidden="true"
                />

                <div
                  className="flex shrink-0 items-center gap-0.5"
                  role="group"
                  aria-label="Test duration"
                >
                  {DURATIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDuration(item)}
                      aria-pressed={duration === item}
                      className={cn(
                        'min-h-8 min-w-10 rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                        duration === item
                          ? 'bg-brand text-brand-foreground'
                          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                      )}
                    >
                      {item}s
                    </button>
                  ))}
                </div>
              </div>
              )}
            </div>
        </section>
      )}

      {!isPublic && showModes && (
        <section className="rounded-2xl border border-border/80 bg-surface/85 p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
              <div className="min-w-0">
                <p className="mb-1.5 pl-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Practice mode
                </p>

                <div
                  className="grid w-full max-w-[360px] grid-cols-3 gap-1 rounded-xl border border-border/70 bg-background/60 p-1 md:flex md:w-fit"
                  role="tablist"
                  aria-label="Typing mode"
                >
                  <ModeTab
                    compact
                    active={mode === 'free'}
                    onClick={() => setMode('free')}
                    icon={Sparkles}
                    label="Free"
                  />
                  <ModeTab
                    compact
                    active={mode === 'dictation'}
                    onClick={() => setMode('dictation')}
                    icon={Headphones}
                    label="Dictation"
                  />
                  <ModeTab
                    compact
                    active={mode === 'custom'}
                    onClick={() => {
                      if (!customText) setShowCustomDialog(true);
                      else setMode('custom');
                    }}
                    icon={ClipboardPaste}
                    label="Custom"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBlindConfirm(isBlind ? 'disable' : 'enable')}
                aria-pressed={isBlind}
                title={
                  isBlind
                    ? 'Blind mode is on. The passage is hidden.'
                    : 'Blind mode is off. This is a practice run.'
                }
                className={cn(
                  'inline-flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:w-[220px]',
                  isBlind
                    ? 'border-brand/30 bg-brand/[0.07] text-foreground hover:bg-brand/10'
                    : 'border-border/80 bg-background/65 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    isBlind
                      ? 'bg-brand/15 text-brand'
                      : 'bg-surface text-muted-foreground'
                  )}
                >
                  {isBlind ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.6} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.6} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-tight text-foreground">
                    Blind mode
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                    {isBlind ? 'On · eligible when scored' : 'Off · practice only'}
                  </span>
                </span>

                <span
                  className={cn(
                    'relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors',
                    isBlind ? 'bg-brand' : 'bg-border'
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      'block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform',
                      isBlind && 'translate-x-4'
                    )}
                  />
                </span>
              </button>

              {mode === 'free' && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 border-t border-border/70 pt-3 md:col-span-2 md:gap-4">
                  <div className="min-w-0">
                    <p
                      id="student-passage-category-label"
                      className="mb-1.5 pl-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      Passage topic
                    </p>

                    <select
                      id="student-passage-category"
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value as Category)
                      }
                      aria-labelledby="student-passage-category-label"
                      className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/20 md:hidden"
                    >
                      {CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <div
                      className="hidden min-h-10 w-fit max-w-full items-center gap-0.5 rounded-xl border border-border/80 bg-background/60 p-1 md:flex"
                      role="group"
                      aria-label="Passage category"
                    >
                      {CATEGORIES.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setCategory(item.value)}
                          aria-pressed={category === item.value}
                          className={cn(
                            'min-h-8 whitespace-nowrap rounded-lg px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:px-2.5',
                            category === item.value
                              ? 'bg-brand text-brand-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 pl-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Time limit
                    </p>

                    <div
                      className="flex min-h-10 w-fit items-center gap-0.5 rounded-xl border border-border/80 bg-background/60 p-1"
                      role="group"
                      aria-label="Test duration"
                    >
                      {DURATIONS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setDuration(item)}
                          aria-pressed={duration === item}
                          className={cn(
                            'min-h-8 min-w-9 rounded-lg px-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                            duration === item
                              ? 'bg-brand text-brand-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                          )}
                        >
                          {item}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
      )}

      {mode !== 'free' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {mode === 'dictation' && (
            <ControlCard>
              <SmallLabel>Dictation</SmallLabel>
              <select
                value={dictationId}
                onChange={(event) => setDictationId(event.target.value)}
                className={selectClass}
              >
                {dictations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {item.category}
                  </option>
                ))}
              </select>
              {isBlind ? (
                <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand">
                  <EyeOff className="h-3 w-3" />
                  Blind mode — eligible to count
                </span>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Reference visible — practice only
                </span>
              )}
            </ControlCard>
          )}

          {mode === 'custom' && (
            <ControlCard>
              <div className="flex items-center justify-between">
                <SmallLabel>Custom text</SmallLabel>
                <button
                  type="button"
                  onClick={() => setShowCustomDialog(true)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                >
                  {customText ? 'Change' : 'Paste text'}
                </button>
              </div>
              {customText ? (
                <div>
                  <p className="truncate text-sm text-foreground">
                    {customText.slice(0, 70)}
                    {customText.length > 70 ? '…' : ''}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {countScoredWords(customText)}{' '}
                    words
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No text yet — paste or type your own passage.
                </p>
              )}
              {customText && (
                <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {isBlind ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {isBlind
                    ? persistsAttempt({ mode, dictationId })
                      ? 'Blind mode — eligible to count'
                      : 'Blind mode — practice only'
                    : 'Reference visible — practice only'}
                </span>
              )}
            </ControlCard>
          )}

          <ControlCard>
            <SmallLabel>Mode</SmallLabel>
            <p className="text-sm text-foreground">
              {isPeeking
                ? 'Reference preview — typing is paused. Start typing to go blind again; this run will not be counted.'
                : isBlind
                  ? persistsAttempt({ mode, dictationId })
                    ? 'Blind mode — type from memory. Scored blind runs count when they meet the minimum duration and character thresholds.'
                    : 'Blind mode — type from memory. This practice is not saved; only dictation attempts are.'
                  : 'Type at your own pace — practice run, not counted.'}
            </p>
            {!isFinished && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(!showModes || isPublic) && (
                  <button
                    type="button"
                    onClick={() =>
                      setBlindConfirm(isBlind ? 'disable' : 'enable')
                    }
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {isBlind ? (
                      <>
                        <Eye className="h-3 w-3" /> Show reference
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Go blind
                      </>
                    )}
                  </button>
                )}
                {isBlind && !isPeeking && (
                  <button
                    type="button"
                    onClick={peekAtReference}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-warning/30 bg-warning/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-warning/10"
                    title="Previewing restarts the attempt and makes it practice-only."
                  >
                    <Eye className="h-3 w-3" /> Peek at reference
                  </button>
                )}
              </div>
            )}
          </ControlCard>
        </div>
      )}

      {isPublic ? (
        state === 'running' ? (
          <div
            className="grid grid-cols-4 gap-2 rounded-2xl border border-border bg-surface px-2.5 py-3 sm:gap-4 sm:px-4"
            aria-label="Live typing statistics"
          >
            <LiveMetric label="Net WPM" value={score.netWpm} />
            <LiveMetric label="Accuracy" value={`${score.accuracy}%`} />
            <LiveMetric label="Time" value={timeDisplay} />
            <LiveMetric
              label="Words"
              value={`${wordsTyped(typed)}/${score.words.total}`}
            />
          </div>
        ) : null
      ) : (
        <div
          className="rounded-2xl border border-border/80 bg-surface/90 p-3 shadow-sm sm:p-4"
          aria-live="polite"
          aria-atomic="true"
        >
          {showModes && (
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/80 pb-2.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                {isPeeking ? (
                  <>
                    <Eye className="h-3 w-3 text-warning" />
                    <span className="text-warning">
                      Previewing — this run won&apos;t be counted
                    </span>
                  </>
                ) : isBlind && !peekedThisRun ? (
                  <>
                    <EyeOff className="h-3 w-3 text-brand" />
                    <span className="text-brand">
                      Blind mode — eligible to count
                    </span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Practice — not counted
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          <div
            className={cn(
              'grid gap-2',
              isBlind && !isFinished
                ? 'grid-cols-2 sm:grid-cols-3'
                : 'grid-cols-3 sm:grid-cols-5'
            )}
          >
            {isBlind && !isFinished ? (
              <>
                <MetricCell label="typed words" value={wordsTyped(typed)} />
                <MetricCell
                  label={timed ? 'time' : 'elapsed'}
                  value={timeDisplay}
                />
                <MetricCell label="accuracy" value="—" muted />
              </>
            ) : (
              <>
                <MetricCell label="net WPM" value={score.netWpm} />
                <MetricCell label="accuracy" value={`${score.accuracy}%`} />
                <MetricCell label="correct words" value={score.words.correct} />
                <MetricCell
                  label="incorrect words"
                  value={incorrectWords}
                  muted
                />
                <MetricCell
                  label={timed ? 'time' : 'elapsed'}
                  value={timeDisplay}
                />
              </>
            )}
          </div>

          {isBlind && !isFinished && (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              No live feedback in blind mode — the comparison appears when you
              submit.
            </p>
          )}

          {!isBlind && !isFinished && (
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Accuracy counts the words and punctuation you have attempted;
              the word counts beside it are separate.
            </p>
          )}
        </div>
      )}

      {!canType ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center sm:py-20">
          <p className="text-sm text-muted-foreground">
            {mode === 'custom'
              ? 'Paste a passage to start.'
              : mode === 'dictation'
                ? 'Pick a dictation to start.'
                : 'No passage available.'}
          </p>
          {showModes && mode === 'custom' && (
            <Button
              onClick={() => setShowCustomDialog(true)}
              className="mt-4 gap-1.5 rounded-xl"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste text
            </Button>
          )}
        </div>
      ) : (
        <div
          ref={typingAreaRef}
          className={cn(
            'scroll-mt-20 flex cursor-text flex-col border bg-surface px-4 py-4 shadow-sm transition-colors sm:px-6',
            isPublic
              ? 'min-h-[260px] rounded-3xl sm:min-h-[36vh] sm:py-8 lg:min-h-[42vh]'
              : 'min-h-[250px] rounded-2xl sm:min-h-[290px] sm:py-6 lg:min-h-[320px]',
            isBlind
              ? 'border-brand/30 ring-1 ring-brand/15 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/30'
              : 'border-border/80 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20'
          )}
          onClick={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          role="textbox"
          aria-label={isBlind ? 'Typing area (blind mode)' : 'Typing passage'}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              restart();
              return;
            }

            if (event.key === ' ' || event.key === 'Backspace') {
              inputRef.current?.focus();
            }
          }}
        >
          {!isPublic && (
            <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {isPeeking ? (
                  <>
                    <Eye className="h-3 w-3 text-warning" />
                    Reference preview — typing paused
                  </>
                ) : isBlind && isFinished && showModes && hasReference ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-brand" />
                    <span className="text-brand">Reference passage</span>
                  </>
                ) : isBlind ? (
                  <>
                    <EyeOff className="h-3 w-3 text-brand" />
                    {mode === 'dictation'
                      ? 'Dictation — type from your shorthand'
                      : 'Blind mode — type from memory'}
                  </>
                ) : mode === 'dictation' ? (
                  <>
                    <Headphones className="h-3 w-3 text-brand" />
                    Dictation reference
                  </>
                ) : mode === 'custom' ? (
                  <>
                    <ClipboardPaste className="h-3 w-3 text-brand" />
                    Your passage
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-brand" />
                    Passage
                  </>
                )}
              </span>
              <span className="font-mono tabular-nums">
                {isPeeking
                  ? 'peeking'
                  : isBlind
                    ? `${wordsTyped(typed)} typed`
                    : `${score.words.correct}/${score.words.total} correct`}
              </span>
            </div>
          )}

          {isPeeking ? (
            <PeekDisplay
              reference={reference}
              onDone={stopPeeking}
              compact={!isPublic}
            />
          ) : isBlind && isFinished && showModes && hasReference ? (
            <ReferencePassageReview reference={reference} />
          ) : isBlind ? (
            <BlindTypingDisplay
              typed={typed}
              state={state}
              compact={!isPublic}
            />
          ) : isFinished ? (
            <div className={passageClass} aria-label="Passage coloured by result">
              {resultChars.map((item, index) => (
                <span
                  key={index}
                  className={cn(
                    item.state === 'correct' && 'text-success',
                    item.state === 'wrong' && 'text-destructive',
                    item.state === 'missed' && 'text-warning'
                  )}
                >
                  {item.ch}
                </span>
              ))}
            </div>
          ) : (
            <div className={passageClass}>
              {liveChars.chars.map((char, index) => (
                <span
                  key={index}
                  ref={char.state === 'current' ? currentCharRef : null}
                  className={cn(
                    char.state === 'untyped' && 'text-muted-foreground/40',
                    char.state === 'correct' && 'text-success',
                    char.state === 'wrong' && 'text-destructive',
                    char.state === 'current' &&
                      'bg-brand/10 text-foreground underline decoration-brand decoration-1 underline-offset-2'
                  )}
                >
                  {char.ch}
                </span>
              ))}
              {liveChars.extras && (
                <span className="rounded-sm bg-destructive/20 text-destructive line-through">
                  {liveChars.extras}
                </span>
              )}
              {state === 'running' && typed.length >= reference.length && (
                <span
                  ref={currentCharRef}
                  className={cn(
                    'relative ml-0.5 -mb-1 inline-block w-[2px] animate-pulse bg-brand align-middle',
                    isPublic ? 'h-7 sm:h-8' : 'h-6 sm:h-7'
                  )}
                />
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            disabled={isFinished || isPeeking}
            data-typing-input="true"
            className="sr-only text-base"
            aria-label="Typing input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
      )}

      {!canType ? null : !isFinished ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {isPeeking
              ? 'Read the passage, then start typing to go blind again. This run is not counted.'
              : state === 'idle'
                ? isBlind
                  ? 'Click the typing area and start. Progress begins on your first keypress.'
                  : 'Click the typing area and start. The timer begins on your first keypress.'
                : null}
            {!isPeeking &&
              state === 'running' &&
              (timed
                ? 'Type naturally — speed will follow.'
                : 'Keep going — submission is automatic when you finish.')}
          </p>

          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="gap-1.5 rounded-xl text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>

            {mode === 'free' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={newFreePassage}
                className="gap-1.5 rounded-xl text-muted-foreground"
              >
                New passage
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {state === 'running' && typed.length > 0 && (
              <Button
                size="sm"
                onClick={manualSubmit}
                className="gap-1.5 rounded-xl"
              >
                Submit
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {hasReference && isFinished && (
        <div ref={resultRef}>
          <CompletionPanel
            score={score}
            elapsedSec={elapsedSec}
            mode={mode}
            counted={isCounted}
            blind={runBlind}
            peeked={peekedThisRun}
            public={isPublic}
            showReview={showModes || mode !== 'free'}
            onRetry={restart}
            onNewFree={mode === 'free' ? newFreePassage : undefined}
          />
        </div>
      )}

      {isFinished && !hasReference && (
        <div
          ref={resultRef}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm sm:p-6"
        >
          {awaitingScore ? (
            <>
              <h2 className="text-base font-semibold text-foreground">
                Scoring your attempt…
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Comparing what you typed with the dictation. The review opens as
                soon as this finishes.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">
                Could not score this attempt
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {scoreError ??
                  'The scoring service did not respond. Your typing is still on screen.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => {
                    recordedRef.current = false;
                    setScoreError(null);
                    setScoreRetry((count) => count + 1);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Score again
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  onClick={restart}
                >
                  Start over
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {showCustomDialog && (
        <CustomTextDialog
          customInput={customInput}
          setCustomInput={setCustomInput}
          customBlind={customBlind}
          setCustomBlind={setCustomBlind}
          onClose={() => setShowCustomDialog(false)}
          onApply={applyCustom}
        />
      )}

      {blindConfirm && (
        <BlindConfirmDialog
          action={blindConfirm}
          onCancel={() => setBlindConfirm(null)}
          onConfirm={() => applyBlindMode(blindConfirm === 'enable')}
        />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
  compact = false,
  locked = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  hint?: string;
  compact?: boolean;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      aria-label={locked ? `${label}. Sign in to unlock.` : label}
      title={locked ? `Sign in to use ${label.toLowerCase()}` : undefined}
      className={cn(
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2',
        compact
          ? 'flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center sm:flex-none sm:px-3'
          : 'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left',
        active
          ? 'bg-brand text-brand-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
      )}
    >
      <Icon
        className={cn('shrink-0', compact ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        strokeWidth={1.5}
      />

      {compact ? (
        <>
          <span className="truncate text-[11px] font-semibold sm:text-sm">
            {label}
          </span>
          {locked && (
            <Lock
              className="h-3 w-3 shrink-0 opacity-75"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}
        </>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">{label}</p>
          {hint && (
            <p
              className={cn(
                'truncate text-[11px]',
                active
                  ? 'text-brand-foreground/70'
                  : 'text-muted-foreground'
              )}
            >
              {hint}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

function BlindTypingDisplay({
  typed,
  state,
  compact = false,
}: {
  typed: string;
  state: TestState;
  compact?: boolean;
}) {
  if (state === 'idle' && typed.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
        <EyeOff
          className="mb-3 h-7 w-7 text-brand/60"
          strokeWidth={1.5}
        />
        <p className="text-base font-medium text-foreground">
          Reference hidden
        </p>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Type from memory or from your shorthand. Your characters appear here
          as you type — no live feedback. The full comparison opens when you
          submit.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-5xl flex-1 whitespace-pre-wrap break-words font-mono',
        compact
          ? 'text-xl leading-[1.8] sm:text-2xl sm:leading-[1.9] lg:text-[1.625rem]'
          : 'text-2xl leading-[2] sm:text-3xl sm:leading-[2.1]'
      )}
    >
      <span className="text-foreground">{typed}</span>
      {state === 'running' && (
        <span
          className={cn(
            'ml-0.5 -mb-1 inline-block w-[2px] animate-pulse bg-brand align-middle',
            compact ? 'h-6 sm:h-7' : 'h-7 sm:h-8'
          )}
        />
      )}
    </div>
  );
}

function ReferencePassageReview({ reference }: { reference: string }) {
  return (
    <p className="mx-auto w-full max-w-5xl flex-1 whitespace-pre-wrap break-words font-mono text-lg leading-[1.85] text-foreground sm:text-xl sm:leading-[1.9]">
      {reference}
    </p>
  );
}

function PeekDisplay({
  reference,
  onDone,
  compact = false,
}: {
  reference: string;
  onDone: () => void;
  compact?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/25 bg-warning/[0.05] px-3 py-2">
        <p className="text-xs text-foreground">
          <span className="font-medium">Reference preview.</span> Typing is
          paused. Start typing to go blind again — this run will not be counted.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onDone}
          className="gap-1.5 rounded-xl"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Back to blind
        </Button>
      </div>
      <div
        className={cn(
          'whitespace-pre-wrap break-words font-mono text-foreground/90',
          compact
            ? 'text-lg leading-[1.8] sm:text-xl sm:leading-[1.9]'
            : 'text-xl leading-[1.9] sm:text-2xl'
        )}
      >
        {reference}
      </div>
    </div>
  );
}

function ControlCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface/85 p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

const selectClass =
  'h-10 rounded-xl border border-border/80 bg-background px-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20';

function LiveMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </p>
      <p className="truncate font-mono text-base font-semibold tabular-nums text-foreground sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function MetricCell({
  label,
  value,
  muted,
}: {
  label: string;
  value: string | number;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/45 px-2 py-2 sm:px-3">
      <p className="truncate text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        {label}
      </p>
      <p
        className={cn(
          'truncate font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.7rem]',
          muted ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CustomTextDialog({
  customInput,
  setCustomInput,
  customBlind,
  setCustomBlind,
  onClose,
  onApply,
}: {
  customInput: string;
  setCustomInput: (value: string) => void;
  customBlind: boolean;
  setCustomBlind: (value: boolean) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const check = inspectCustomText(customInput);
  const cleaned = check.text;
  const wordCount = check.words;
  const canStart = check.ok;

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCustomInput(text);
    } catch {
      textareaRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-border bg-surface p-6 shadow-2xl animate-scale-in sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Paste your own text
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              English only. Line breaks and smart quotes are cleaned up so the
              score stays accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:scale-105"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Your text
          </span>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:border-brand/30 hover:scale-[1.02]"
          >
            <ClipboardPaste className="h-3 w-3" />
            Paste from clipboard
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
          placeholder="Paste or type English text (at least 10 words)…"
          rows={8}
          className="max-h-64 w-full resize-y overflow-auto rounded-3xl border border-border bg-background p-5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
        />

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · min {MIN_CUSTOM_WORDS} ·{' '}
            {cleaned.length}/{MAX_CUSTOM_CHARS} chars
          </span>
          {check.tooLong && (
            <span className="text-destructive">
              Too long — trim to {MAX_CUSTOM_CHARS} characters
            </span>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={customBlind}
            onChange={(event) => setCustomBlind(event.target.checked)}
            className="h-4 w-4 rounded border-border bg-background accent-brand"
          />
          Hide reference (blind runs count when they meet the score minimum)
        </label>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
          <Button variant="outline" onClick={onClose} className="rounded-full px-6">
            Cancel
          </Button>
          <Button onClick={onApply} disabled={!canStart} className="rounded-full px-6">
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

function BlindConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: 'enable' | 'disable';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const enabling = action === 'enable';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blind-confirm-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {enabling ? (
              <EyeOff className="h-4 w-4 text-brand" strokeWidth={1.5} />
            ) : (
              <Eye className="h-4 w-4 text-brand" strokeWidth={1.5} />
            )}
            <h3
              id="blind-confirm-title"
              className="text-xl font-bold text-foreground"
            >
              {enabling ? 'Enable blind mode?' : 'Turn off blind mode?'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:scale-105"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {enabling
            ? 'The passage will be hidden. Blind runs count only when they meet the minimum scoring thresholds.'
            : 'The passage will be visible while you type. Runs with the passage visible are practice only.'}
        </p>
        <p className="mt-3 rounded-xl border border-warning/25 bg-warning/[0.05] px-3 py-2 text-xs text-foreground">
          Your current attempt will be restarted.
        </p>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
          <Button
            variant="outline"
            onClick={onCancel}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} className="rounded-xl">
            {enabling ? 'Enable blind mode' : 'Show the passage'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompletionPanel({
  score,
  elapsedSec,
  mode,
  counted,
  blind,
  peeked,
  public: isPublic,
  showReview,
  onRetry,
  onNewFree,
}: {
  score: ScoreResult;
  elapsedSec: number;
  mode: Mode;
  counted: boolean;
  blind: boolean;
  peeked: boolean;
  public?: boolean;
  showReview: boolean;
  onRetry: () => void;
  onNewFree?: () => void;
}) {
  const words = score.words;
  const items = score.items;
  const missedWordCount = words.missed;
  const missedPunctCount = score.punctuation.missed;

  const verdict =
    score.accuracy >= 95
      ? {
          title: isPublic
            ? 'Excellent — highly accurate.'
            : 'Excellent — your transcription is highly accurate.',
          detail: 'Push for speed next time.',
        }
      : score.accuracy >= 85
        ? {
            title: 'Solid run — keep the consistency.',
            detail: 'Keep practising to maintain this level.',
          }
        : {
            title: 'Type naturally — speed will follow.',
            detail:
              mode === 'free'
                ? 'Slow down on the tricky words, then go again.'
                : 'See your word-by-word comparison below.',
          };

  return (
    <div className="animate-fade-in-up space-y-4 rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {verdict.title}
            </h2>
            {!isPublic && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  counted
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                {counted ? (
                  <>
                    <EyeOff className="h-3 w-3" /> Counted — blind run
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" /> Practice — not counted
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{verdict.detail}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} className="gap-1.5 rounded-xl">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          {onNewFree && (
            <Button
              variant="outline"
              onClick={onNewFree}
              className="gap-1.5 rounded-xl"
            >
              New passage
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
        <ResultStat label="Net WPM" value={score.netWpm} accent={counted} />
        <ResultStat
          label="Attempted accuracy"
          value={`${score.accuracy}%`}
          accent={counted}
        />
        <ResultStat label="Completion" value={`${score.completion}%`} />
        <ResultStat label="Time" value={formatClock(elapsedSec)} />
      </div>

      {/* These two numbers answer different questions, so the
          denominator for each is spelled out instead of letting a
          reader compare "words correct" with "accuracy". */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          Attempted accuracy
        </span>{' '}
        = {score.items.correct} correct ÷{' '}
        {score.alignment.evaluatedItems} items you attempted (words +
        punctuation). <span className="font-medium text-foreground">
          Completion
        </span>{' '}
        = how much of the passage you covered. Case counts.
      </p>

      <div className="border-t border-border pt-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium" />
                <th className="px-3 py-2 text-right font-medium">
                  In passage
                </th>
                <th className="px-3 py-2 text-right font-medium">Correct</th>
                <th className="px-3 py-2 text-right font-medium">Wrong</th>
                <th className="px-3 py-2 text-right font-medium">Missed</th>
                <th className="px-3 py-2 text-right font-medium">Extra</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 font-medium text-foreground">
                  Words
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {words.total}
                </td>
                <td className="px-3 py-2 text-right text-success">
                  {words.correct}
                </td>
                <td className="px-3 py-2 text-right text-destructive">
                  {words.incorrect}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {missedWordCount}
                </td>
                <td className="px-3 py-2 text-right text-destructive">
                  {words.extra}
                </td>
              </tr>
              {score.punctuation.total > 0 && (
                <tr>
                  <td className="px-3 py-2 font-medium text-foreground">
                    Punctuation
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">
                    {score.punctuation.total}
                  </td>
                  <td className="px-3 py-2 text-right text-success">
                    {score.punctuation.correct}
                  </td>
                  <td className="px-3 py-2 text-right text-destructive">
                    {score.punctuation.incorrect}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {missedPunctCount}
                  </td>
                  <td className="px-3 py-2 text-right text-destructive">
                    {score.punctuation.extra}
                  </td>
                </tr>
              )}
              <tr className="border-t border-border bg-background/60">
                <td className="px-3 py-2 font-medium text-foreground">
                  All scored items
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {items.total}
                </td>
                <td className="px-3 py-2 text-right text-success">
                  {items.correct}
                </td>
                <td className="px-3 py-2 text-right text-destructive">
                  {items.incorrect}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {items.missed}
                </td>
                <td className="px-3 py-2 text-right text-destructive">
                  {items.extra}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="ml-auto">Gross {score.rawWpm} WPM</span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Words and punctuation are scored as separate items. &quot;Missed&quot;
        includes everything you did not type, including the rest of the
        passage. Only attempted items affect accuracy.
      </p>

      {!score.scored && (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          This attempt is too short for a speed score. It needs at least 3
          seconds and 10 typed characters. Accuracy above is still measured.
        </p>
      )}

      {!isPublic &&
        (mode === 'dictation' ? (
          // The panel only renders for dictation once the server has
          // returned the transcript, which means the row was written.
          <p className="rounded-xl border border-success/20 bg-success/[0.05] px-3 py-2 text-xs text-muted-foreground">
            Saved to your results.
          </p>
        ) : (
          <p className="rounded-xl border border-warning/20 bg-warning/[0.045] px-3 py-2 text-xs text-muted-foreground">
            This score is shown for this visit only — free practice and custom
            text are not saved.
          </p>
        ))}

      {!counted && !isPublic && (
        <p className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {mode !== 'dictation'
            ? 'Practice only — only dictation attempts are saved to your results.'
            : peeked
              ? 'You previewed the reference during this attempt, so this is practice only. Restart to try a clean blind run.'
              : blind
                ? 'This blind attempt did not meet the minimum scoring thresholds, so it is not counted.'
                : 'The passage was visible during this run, so it is practice only. Turn on blind mode to record a scored result.'}
        </p>
      )}

      {showReview && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Your typing
                </h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Color-coded against the passage.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <LegendSwatch
                  className="bg-success/30"
                  borderClass="border-success/40"
                  label="Correct"
                />
                <LegendSwatch
                  className="bg-destructive/30"
                  borderClass="border-destructive/40"
                  label="Wrong / extra"
                />
                <LegendSwatch
                  className="bg-warning/30"
                  borderClass="border-warning/40"
                  label="Missed"
                />
              </div>
            </div>

            <ReviewBlock alignment={score.alignment} />
          </div>

          <DiffTable entries={score.alignment.tokenDiff} />
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'font-mono text-2xl font-semibold tabular-nums tracking-tight',
          accent ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LegendSwatch({
  className,
  label,
  borderClass,
}: {
  className: string;
  label: string;
  borderClass?: string;
}) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-muted-foreground">
      <span
        className={cn(
          'h-2 w-2 rounded-full border',
          borderClass ?? 'border-border',
          className
        )}
      />
      {label}
    </span>
  );
}

function ReviewBlock({
  alignment,
}: {
  alignment: AlignmentResult;
}) {
  const displayItems = useMemo(
    () => buildTokenDisplayItems(alignment),
    [alignment]
  );

  // Skipped words are "missed"; the untouched tail was never attempted.
  // Showing both as "missed" overstated the error, so they are split.
  const { missed: missedTokens, notReached } = useMemo(
    () => splitMissedNotReached(alignment),
    [alignment]
  );

  const displayChar = (ch: string) => (ch === ' ' ? '\u00A0' : ch);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Your typing
        </span>
        <span className="text-[10px] text-muted-foreground">
          Green correct · red wrong or extra · amber missed
        </span>
      </div>

      <div className="max-h-[32rem] overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <p className="whitespace-pre-wrap break-words font-mono text-[15px] leading-[1.9] tracking-[0.01em] sm:text-base sm:leading-[2] lg:text-[17px]">
          {displayItems.length === 0 ? (
            <span className="text-muted-foreground">Nothing typed.</span>
          ) : (
            displayItems.map((item, index) => {
              if (item.state === 'correct') {
                return (
                  <span key={index} className="font-medium text-success">
                    {displayChar(item.ch)}
                  </span>
                );
              }

              // Extras are red like wrong tokens but struck through,
              // so "how many red tokens" never silently includes
              // insertions the table reports in its own "Extra" column.
              return (
                <span
                  key={index}
                  title={
                    item.state === 'extra'
                      ? 'Extra — you typed this but the passage does not have it.'
                      : item.expected
                        ? `Expected “${item.expected}”.`
                        : undefined
                  }
                  className={cn(
                    'text-destructive',
                    item.state === 'extra' && 'line-through'
                  )}
                >
                  {displayChar(item.ch)}
                </span>
              );
            })
          )}
        </p>

        {missedTokens.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Missed words &amp; punctuation
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missedTokens.map((entry, i) => (
                <span
                  key={`missed-${entry.index}-${i}`}
                  title={`Missed ${entry.tokenKind === 'punct' ? 'punctuation' : 'word'} ${entry.index + 1}.`}
                  className="rounded-md bg-warning/10 px-1.5 py-1 font-mono text-[13px] text-warning"
                >
                  {entry.expected}
                </span>
              ))}
            </div>
          </div>
        )}

        {notReached.length > 0 && (
          <p className="mt-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            {notReached.length} further item
            {notReached.length === 1 ? '' : 's'} were never reached — the rest
            of the passage.
          </p>
        )}
      </div>
    </div>
  );
}

function DiffSnippet({
  value,
  emptyLabel,
  tone,
}: {
  value: string | null;
  emptyLabel: string;
  tone: 'plain' | 'missed' | 'wrong';
}) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs italic text-muted-foreground">
        <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-warning/60" />
        {emptyLabel}
      </span>
    );
  }

  const MAX = 60;
  const preview = value.slice(0, MAX);

  return (
    <span
      className={cn(
        'block break-words font-mono text-[13px] leading-relaxed',
        tone === 'missed' && 'text-warning',
        tone === 'wrong' && 'text-destructive',
        tone === 'plain' && 'text-foreground'
      )}
    >
      “{preview}
      {value.length > MAX ? '…' : ''}”
      {value.length > MAX && (
        <span className="ml-1 text-muted-foreground">
          +{value.length - MAX} more
        </span>
      )}
    </span>
  );
}

function DiffTable({ entries }: { entries: TokenDiffEntry[] }) {
  const tableRows = useMemo(
    () => entries.filter((entry) => entry.kind !== 'missed'),
    [entries]
  );
  const LIMIT = 80;
  const shown = tableRows.slice(0, LIMIT);
  const hidden = tableRows.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Word &amp; punctuation differences</span>
        <span className="ml-auto font-mono tabular-nums">
          {tableRows.length} wrong/extra
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-4 text-sm text-foreground">
          No differences — every word and punctuation mark matched the passage.
        </p>
      ) : tableRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-background px-3 py-4 text-sm text-muted-foreground">
          No wrong or extra items. Missed items are marked in the review above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">Passage</th>
                  <th className="px-2 py-2 text-left font-medium">You typed</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry, rowIndex) => (
                  <tr
                    key={`${entry.index}-${entry.kind}-${rowIndex}`}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-2 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {entry.index + 1}
                      <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">
                        {entry.tokenKind === 'punct' ? 'punct' : 'word'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={entry.expected}
                        emptyLabel="—"
                        tone="plain"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={entry.actual}
                        emptyLabel="skipped"
                        tone="wrong"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Showing the first {LIMIT} of {tableRows.length} differences.
            </p>
          )}
        </div>
      )}
    </div>
  );
}


