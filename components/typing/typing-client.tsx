'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react';
import { CompletionPanel } from './completion-panel';
import { createSubmissionKey, useDictationSubmission } from './use-dictation-submission';
import { useTypingAlignment } from './use-typing-alignment';
import { useTypingClock } from './use-typing-clock';
import Link from 'next/link';
import { Youtube } from 'lucide-react';
import { dictationMetadata, type DictationMetadata } from '@/lib/dictation-catalog';
import { youtubeWatchUrl } from '@/lib/youtube';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
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
import { Modal } from '@/components/ui/modal';
import { ChoiceMenu } from '@/components/ui/choice-menu';
import { Button } from '@/components/ui/button';
import {
  align,
  buildLiveChars,
  countScoredWords,
  formatClock,
  MAX_ALIGN_CHARS,
  MAX_CUSTOM_CHARS,
  normalizeText,
  scoreFromAlignment,
  type ScoreResult,
} from '@/lib/typing/scoring';
import type { Passage } from '@/lib/passages/model';
import { generatePassage, practiceReference, readPassageHistory, rememberPassage, timedCharacters } from '@/lib/passage-generator';
import {
  inspectCustomText,
  MIN_CUSTOM_WORDS,
} from '@/lib/typing/custom-text';
import {
  acceptsInput,
  typedCharCap,
  usesAnchoredAutoFinish,
} from '@/lib/typing/mode-rules';
import {
  activeLineIndex,
  lineScrollTop,
  TYPING_VIEWPORT_HEIGHT_EM,
} from '@/lib/typing/line-window';
type TestState = 'idle' | 'running' | 'complete';
type Duration = 0 | 15 | 30 | 60;
type Category = 'mixed' | 'Legal' | 'Professional' | 'General';
type Mode = 'free' | 'dictation' | 'custom';

const DURATIONS: Duration[] = [15, 30, 60, 0];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Professional', label: 'Professional' },
  { value: 'General', label: 'General' },
];

export type TypingClientProps = {
  variant?: 'public' | 'student';
  initialMode?: Mode;
  libraryHref?: string;
  initialDictationId?: string;
  /**
   * Server-rendered first passage. Without it the free typing area is
   * empty at first paint, which shifts the page once the mount effect
   * fills it in. Student pages may omit it and keep the client-only
   * behaviour.
   */
  initialPassage?: Passage;
};

export default function TypingClient({
  variant = 'public',
  initialMode = 'free',
  libraryHref = '/student/dictations',
  initialDictationId,
  initialPassage,
}: TypingClientProps) {
  const showModes = variant === 'student';
  const isPublic = variant === 'public';
  const router = useRouter();

  // Auth state comes from the shared provider. On protected pages it is
  // server-seeded, so this is known on first paint; on the public home
  // it resolves once and unlocks the member tabs.
  const { isAuthenticated: authenticated, user } = useAuth();
  const canUseDictation = !isPublic || user?.role === 'student';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [duration, setDuration] = useState<Duration>(30);
  const [passageLength, setPassageLength] = useState<'full' | 'short'>('full');
  const [category, setCategory] = useState<Category>('mixed');

  // Dictations fetched from API (metadata only, no transcripts).
  // Transcripts are fetched server-side during scoring.
  const dictationId = initialDictationId ?? '';
  const [dictation, setDictation] = useState<DictationMetadata | null>(null);
  const [dictationsState, setDictationsState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [catalogRequest, setCatalogRequest] = useState(0);
  useEffect(() => {
    if (mode !== 'dictation' || !canUseDictation || !dictationId || dictation) return;
    const controller = new AbortController();
    fetch(`/api/dictations?id=${encodeURIComponent(dictationId)}`, { signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setDictationsState(response.status === 404 || response.status === 400 ? 'unavailable' : 'error');
          return;
        }
        const data: { dictation: DictationMetadata } = await response.json();
        if (controller.signal.aborted) return;
        setDictation(data.dictation);
        setDictationsState('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setDictationsState('error'); });
    return () => controller.abort();
  }, [mode, canUseDictation, dictationId, dictation, catalogRequest]);

  const selectedDictationId = dictation?.id ?? '';
  const video = youtubeWatchUrl(dictation?.youtubeId);

  const [customText, setCustomText] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customBlind, setCustomBlind] = useState(false);
  const [draftBlind, setDraftBlind] = useState(false);
  const [passage, setPassage] = useState(initialPassage);

  const [typed, setTyped] = useState('');
  const [state, setState] = useState<TestState>('idle');
  const timed = mode === 'free' && passageLength === 'full' && duration > 0;
  const onFinish = useCallback(() => setState('complete'), []);
  const { deadline, elapsedMs, finish, reset: resetClock, start: startClock } =
    useTypingClock(state === 'running', duration, timed, onFinish);
  const [showFreeReference, setShowFreeReference] = useState(true);
  const showReference = mode === 'free' ? showFreeReference : mode === 'custom' && !customBlind;
  const [blindConfirm, setBlindConfirm] = useState<null | 'enable' | 'disable'>(
    null
  );
  const [submissionRun, setSubmissionRun] = useState<{ key: string; passageId: string } | null>(null);
  const submission = useMemo(() => (
    state === 'complete' && mode === 'dictation' && submissionRun && submissionRun.passageId === selectedDictationId
      ? { submissionKey: submissionRun.key, passageId: selectedDictationId, typed, elapsedMs }
      : null
  ), [state, mode, selectedDictationId, submissionRun, typed, elapsedMs]);
  const dictationScore = useDictationSubmission(submission);
  const dictationTranscript = dictationScore.result?.reference ?? '';

  useEffect(() => {
    if (isPublic && !authenticated && mode !== 'free') {
      // Auth resolves after mount; drop a member-only mode once we know
      // the visitor is a guest.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('free');
      setTyped('');
      setShowFreeReference(true);
      setCustomText('');
      setCustomInput('');
      resetClock();
      setState('idle');
    }
  }, [isPublic, authenticated, mode, resetClock]);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const passageHistory = useRef<string[] | null>(null);
  const pendingPassage = useRef(false);
  const [passageLoading, setPassageLoading] = useState(false);
  const [failedSelection, setFailedSelection] = useState<[Category, Duration, string?] | null>(null);

  const changePassage = useCallback(async (nextCategory: Category, nextDuration: Duration, previousId?: string) => {
    if (pendingPassage.current) return false;
    pendingPassage.current = true;
    setPassageLoading(true);
    setFailedSelection(null);
    try {
      const history = passageHistory.current ?? readPassageHistory();
      const next = await generatePassage({ category: nextCategory, seconds: nextDuration, previousId, history });
      passageHistory.current = rememberPassage(next.id, history);
      setPassage(next);
      setCategory(nextCategory);
      setDuration(nextDuration);
      return true;
    } catch {
      setFailedSelection([nextCategory, nextDuration, previousId]);
      return false;
    } finally {
      pendingPassage.current = false;
      setPassageLoading(false);
    }
  }, []);

  const reference = useMemo(() => {
    if (mode === 'dictation') {
      if (isPublic && !authenticated) return '';
      return dictationTranscript; // Populated after scoring for review.
    }

    if (mode === 'custom') {
      if (isPublic && !authenticated) return '';
      return customText;
    }

    return practiceReference(passage?.text ?? '', passageLength, duration);
  }, [mode, dictationTranscript, customText, passage, isPublic, authenticated, passageLength, duration]);

  const scoredReferenceWords = useMemo(() => countScoredWords(reference), [reference]);
  const referenceWords = useMemo(() => reference.trim() ? reference.trim().split(/\s+/).length : 0, [reference]);

  useEffect(() => {
    // Preserve the server reference through hydration. Remember it for
    // subsequent draws without replacing what the typist already sees.
    const history = readPassageHistory();
    passageHistory.current = initialPassage ? rememberPassage(initialPassage.id, history) : history;
  }, [initialPassage]);

  useEffect(() => {
    if (mode === 'free' && !passage) {
      void changePassage(category, duration);
    }
  }, [mode, passage, category, duration, changePassage]);

  useEffect(() => {
    // Switching mode or dictation resets the run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTyped('');
    setState('idle');
    resetClock();

    // Switching dictation must not keep the transcript fetched for the
    // previous one — otherwise an earlier review leaks into this run.
    setSubmissionRun(null);

    if (mode === 'free') setShowFreeReference(true);

    // Category changes are intentionally handled separately.
  }, [mode, dictationId, customText, customBlind, resetClock]);

  useEffect(() => {
    // A duration change resets the run.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTyped('');
    setState('idle');
    resetClock();
  }, [duration, resetClock]);

  useEffect(() => {
    if (state !== 'running' || !usesAnchoredAutoFinish(mode, reference.length)) {
      return;
    }

    const normalizedTyped = normalizeText(typed);
    if (
      normalizedTyped.length > 0 &&
      normalizedTyped === normalizeText(reference)
    ) {
      // Reaching the end of the reference finishes the run.
      finish();
    }
  }, [typed, state, mode, reference, finish]);

  const manualSubmit = useCallback(() => {
    if (state === 'running') finish();
  }, [state, finish]);

  // Monkeytype-style line movement: keep the active line inside a
  // fixed-height window instead of scrolling the whole page to the caret.
  // The window is exactly five lines tall, so every scroll offset lands
  // on a line boundary and no glyph is ever cut in half. Jumps are
  // instant: a smooth animation makes the caret outrun the text when a
  // fast typist crosses two lines in one keystroke.
  const centerCurrentLine = useCallback(() => {
    const viewport = viewportRef.current;
    const current = currentCharRef.current;
    if (!viewport || !current) return;

    const content = viewport.firstElementChild as HTMLElement | null;
    const lineHeight =
      (content && parseFloat(getComputedStyle(content).lineHeight)) || 36;

    const line = activeLineIndex(current.offsetTop, lineHeight);
    const targetScrollTop = lineScrollTop(
      line,
      lineHeight,
      viewport.clientHeight,
      viewport.scrollHeight
    );
    if (Math.abs(viewport.scrollTop - targetScrollTop) >= 1) viewport.scrollTop = targetScrollTop;
  }, []);

  useLayoutEffect(() => {
    if (state === 'complete') return;
    centerCurrentLine();
  }, [typed, state, reference, centerCurrentLine]);

  // Re-centre after a resize or orientation change, when the line height
  // and viewport height both change without a keystroke.
  useEffect(() => {
    if (state === 'complete') return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => centerCurrentLine());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [state, reference, centerCurrentLine]);

  const startIfIdle = useCallback(() => {
    if (state !== 'idle') return;

    setState('running');
    startClock();
    if (mode === 'dictation' && selectedDictationId) {
      setSubmissionRun({ key: createSubmissionKey(), passageId: selectedDictationId });
    }
  }, [mode, selectedDictationId, startClock, state]);

  const commitTyped = useCallback(
    (next: string) => {
      if (mode === 'free' && pendingPassage.current) return;
      // Dictation types against a hidden reference — it only needs a
      // selected dictation, not local text.
      if (deadline !== null && performance.now() >= deadline) {
        finish(deadline);
        return;
      }
      if (!acceptsInput({ mode, referenceLength: reference.length, dictationId: selectedDictationId })) {
        return;
      }

      // Clamp to the engine cap so align() never throws and a held key
      // cannot produce an unscoreable payload.
      const value = next.slice(
        0,
        typedCharCap(reference.length, MAX_ALIGN_CHARS)
      );
      startIfIdle();

      setTyped(value);
    },
    [deadline, finish, mode, reference, selectedDictationId, startIfIdle]
  );

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (state === 'complete') return;

    commitTyped(event.target.value);
  };

  const restoreTypingFocus = useCallback(() => {
    // Only explicit practice actions restore focus. On touch screens,
    // leave opening the virtual keyboard to a tap on the typing surface.
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const trigger = document.activeElement;
    requestAnimationFrame(() => {
      if (document.activeElement !== trigger && document.activeElement !== document.body) return;
      inputRef.current?.focus();
    });
  }, []);

  const restart = useCallback(() => {
    setTyped('');
    setState('idle');
    resetClock();
    // A fresh dictation run must be re-scored from the transcript the
    // server holds, not the one fetched for the previous review.
    setSubmissionRun(null);
    restoreTypingFocus();
  }, [resetClock, restoreTypingFocus]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
      event.preventDefault();
      // Dictation has no auto-finish (no local reference) and is not
      // timed, so Enter is the natural way to submit.
      if (state === 'running') manualSubmit();
      return;
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
  };

  // Only hand off a printable key from an unfocused page. The real
  // input handles every subsequent key, selection, deletion and IME.
  useEffect(() => {
    const input = inputRef.current;
    if (!input || passageLoading || state === 'complete' || showCustomDialog || blindConfirm) return;
    if (!acceptsInput({ mode, referenceLength: reference.length, dictationId: selectedDictationId })) return;
    const document = input.ownerDocument;

    const activateInput = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const onBarePage = (element: Element | EventTarget | null) =>
        element === document.body || element === document.documentElement;
      if (!onBarePage(document.activeElement) || !onBarePage(event.target)) return;
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      if (!input.isConnected || input.disabled || input.readOnly) return;
      const altGraph = event.getModifierState('AltGraph');
      if (event.metaKey || (!altGraph && (event.ctrlKey || event.altKey))) return;
      if (Array.from(event.key).length !== 1 || /[\p{C}\p{Zl}\p{Zp}]/u.test(event.key)) return;

      input.focus();
      if (document.activeElement !== input) return;
      event.preventDefault();
      commitTyped(input.value + event.key);
    };

    document.addEventListener('keydown', activateInput);
    return () => document.removeEventListener('keydown', activateInput);
  }, [state, mode, reference.length, selectedDictationId, showCustomDialog, blindConfirm, commitTyped, passageLoading]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const needsAlignment = showReference || state === 'complete';
  const { alignment, pending: alignmentPending, error: alignmentError } =
    useTypingAlignment(reference, typed, needsAlignment, state === 'complete');

  useEffect(() => {
    if (state !== 'complete') return;

    requestAnimationFrame(() => {
      const target = resultRef.current;

      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
    });
  }, [state, alignment]);

  const emptyAlignment = useMemo(() => align('', ''), []);
  const serverScore = dictationScore.result?.score;
  const score: ScoreResult = useMemo(() => {
    const computed = scoreFromAlignment(alignment ?? emptyAlignment, elapsedMs);
    return serverScore
      ? { ...computed, ...serverScore, wpm: serverScore.netWpm }
      : computed;
  }, [alignment, emptyAlignment, elapsedMs, serverScore]);

  const liveChars = useMemo(
    () => buildLiveChars(reference, typed),
    [reference, typed]
  );

  // Once finished, colour the passage from the SAME token alignment as
  // the result table. The live indicator is positional, so a single
  // missed character shifts every colour after it and the screen
  // disagrees with the table.
  const newFreePassage = useCallback(async () => {
    if (state === 'running' || !await changePassage(category, duration, passage?.id)) return;
    restart();
  }, [category, duration, passage, changePassage, restart, state]);

  const chooseDuration = (next: Duration) => {
    if (pendingPassage.current || state !== 'idle') return;
    if (passage && passage.characterCount >= timedCharacters(next)) setDuration(next);
    else void changePassage(category, next, passage?.id);
  };

  const applyBlindMode = useCallback(
    (blind: boolean) => {
      if (isPublic && !authenticated) return;

      if (mode === 'custom') setCustomBlind(blind);
      else if (mode === 'free') setShowFreeReference(!blind);
      setBlindConfirm(null);
      setTyped('');
      setState('idle');
      resetClock();
      restoreTypingFocus();
    },
    [isPublic, authenticated, mode, resetClock, restoreTypingFocus]
  );

  const applyCustom = () => {
    if (isPublic && !authenticated) return;

    const check = inspectCustomText(customInput);
    if (!check.ok) return;

    if (!confirmDiscard()) return;
    setCustomBlind(draftBlind);
    restart();
    setCustomText(check.text);
    setCustomInput('');
    setShowCustomDialog(false);
    setMode('custom');
    restoreTypingFocus();
  };

  const hasUnfinishedWork = Boolean(typed && (state === 'running' || (mode === 'dictation' && !dictationScore.result)));
  const confirmDiscard = () => !hasUnfinishedWork ||
    window.confirm('Discard this unfinished practice? Your typed work will be lost.');

  useEffect(() => {
    if (!hasUnfinishedWork || mode === 'free') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnfinishedWork, mode]);

  const openCustomEditor = () => {
    setCustomInput(customText);
    setDraftBlind(customBlind);
    setShowCustomDialog(true);
  };

  const isFinished = state === 'complete';
  const isBlind = !showReference;
  const isCounted = Boolean(dictationScore.result);
  const hasReference = reference.length > 0;
  const canType = acceptsInput({
    mode,
    referenceLength: reference.length,
    dictationId: selectedDictationId,
  });
  const passageBase = 'w-full whitespace-pre-wrap break-words font-mono';
  const passageType = isPublic
    ? 'text-[clamp(1.4rem,1.05rem+1.15vw,2.5rem)] leading-[1.9]'
    : 'text-[clamp(1.3rem,1rem+1.05vw,2.35rem)] leading-[1.9]';
  const timeDisplay = formatClock(
    timed ? Math.max(0, duration - elapsedSec) : elapsedSec
  );

  const wordsTyped = (text: string) => countScoredWords(text);


  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="practice-console" aria-label="Typing test settings">
        <div className={mode === 'free' ? "practice-settings" : "flex flex-wrap items-end justify-between gap-2"}>
          <div className={cn("practice-mode", mode !== 'free' && "min-w-0 flex-1 basis-52")}>
            <p className="control-caption">Practice mode</p>
            <div className="practice-track" role="group" aria-label="Typing mode" style={{ '--slots': 3, '--selected': ['free', 'dictation', 'custom'].indexOf(mode) } as React.CSSProperties}>
              <ModeTab compact active={mode === 'free'} icon={Sparkles} label="Free" onClick={() => {
                if (pendingPassage.current || (mode !== 'free' && !confirmDiscard())) return;
                if (isPublic && isBlind) setShowFreeReference(true);
                setMode('free');
              }} />
              <ModeTab compact active={mode === 'dictation'} icon={Headphones} label="Dictation" locked={!canUseDictation}
                onClick={() => {
                  if (pendingPassage.current || (mode !== 'dictation' && !confirmDiscard())) return;
                  if (canUseDictation) setMode('dictation');
                  else router.push('/login');
                }} />
              <ModeTab compact active={mode === 'custom'} icon={ClipboardPaste} label="Custom" locked={isPublic && !authenticated}
                onClick={() => {
                  if (pendingPassage.current) return;
                  if (isPublic && !authenticated) router.push('/login');
                  else if (!customText) openCustomEditor();
                  else if (mode === 'custom' || confirmDiscard()) setMode('custom');
                }} />
            </div>
          </div>
          {mode === 'free' && <>
            <div className="practice-topic">
              <p className="control-caption">Topic</p>
              <ChoiceMenu label="Passage topic" value={category} options={CATEGORIES} onChange={(next) => void changePassage(next, duration, passage?.id)} disabled={state !== 'idle' || passageLoading} />
            </div>
            <div className="practice-length">
              <p className="control-caption">Passage length</p>
              <ChoiceMenu label="Passage length" value={passageLength} onChange={setPassageLength} disabled={state !== 'idle' || passageLoading}
                options={[{value: 'full', label: 'Full passage'}, {value: 'short', label: 'First 30 words'}]} />
            </div>
            <div className="practice-time">
              <p className="control-caption">Time limit</p>
              <div className="practice-track" role="group" aria-label="Test duration" style={{ '--slots': DURATIONS.length, '--selected': DURATIONS.indexOf(passageLength === 'short' ? 0 : duration) } as React.CSSProperties}>
                {DURATIONS.map(item => <button key={item} type="button" aria-pressed={(passageLength === 'short' ? 0 : duration) === item} disabled={state !== 'idle' || passageLoading || passageLength === 'short'} onClick={() => chooseDuration(item)}>
                  {item ? item + 's' : 'Off'}
                </button>)}
              </div>
            </div>
          </>}
          {mode === 'custom' && customText && (
            <Button variant="outline" className="ml-auto min-h-11" onClick={openCustomEditor}>Edit passage</Button>
          )}
        </div>
        {mode === 'free' && passageLoading && <p role="status" className="mt-2 text-sm text-muted-foreground">Loading passage…</p>}
        {mode === 'free' && state !== 'running' && failedSelection && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Could not load a passage. <button type="button" className="underline" onClick={async () => { if (await changePassage(...failedSelection)) restart(); }}>Try again</button>
          </p>
        )}
        {showModes && mode === 'free' && <div className="mt-3 border-t border-border pt-3">
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
                  'inline-flex min-h-11 w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:w-[220px]',
                  isBlind
                    ? 'border-brand/30 bg-brand/[0.07] text-foreground hover:bg-brand/10'
                    : 'border-border/80 bg-background/65 text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
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
                  <span className="mt-0.5 block text-xs leading-tight text-muted-foreground">
                    {isBlind ? 'On · reference hidden' : 'Off · reference visible'}
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

        </div>}
      </section>

      {mode === 'dictation' && (
        <section className="panel space-y-2 p-4" aria-label="Selected dictation">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words font-semibold">{dictation?.title ?? 'Choose a dictation'}</h2>
              {dictation && <p className="text-sm text-muted-foreground">{dictationMetadata(dictation)}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {video && <Button asChild variant="outline"><a href={video} target="_blank" rel="noopener noreferrer" className="gap-2"><Youtube size={16} aria-hidden /> Open on YouTube <span className="sr-only">(new tab)</span></a></Button>}
              <Button asChild variant="outline"><Link href={libraryHref} prefetch={false} onClick={event => { if (!confirmDiscard()) event.preventDefault(); }}>Dictation library</Link></Button>
              {isCounted && <Button asChild variant="outline"><Link prefetch={false} href={`/student/results?dictationId=${encodeURIComponent(selectedDictationId)}`}>Results</Link></Button>}
            </div>
          </div>
          {dictation ? <p className="text-sm text-muted-foreground">Typing starts the elapsed clock.{video && ' YouTube plays independently.'}</p>
            : !dictationId ? <p className="text-sm text-muted-foreground">Select Practice on a dictation in the library.</p>
              : dictationsState === 'unavailable' ? <p role="status">This dictation is unavailable.</p>
                : dictationsState === 'error' ? <p role="alert">Could not load the dictation. <button className="text-brand underline" onClick={() => { setDictationsState('loading'); setCatalogRequest(value => value + 1); }}>Try again</button></p>
                  : <p role="status">Loading dictation…</p>}
        </section>
      )}

      {!isFinished && canType && (
        <div className={cn(
          'grid gap-2 border-y border-border/70 py-2 sm:gap-6',
          isBlind ? 'grid-cols-2' : 'grid-cols-4',
        )} aria-label="Live typing statistics">
          {isBlind ? (
            <>
              <LiveMetric label={timed ? 'Time left' : 'Elapsed typing'} value={timeDisplay} timer />
              <LiveMetric label="Words typed" value={wordsTyped(typed)} />
            </>
          ) : (
            <>
              <LiveMetric label="Net WPM" value={state === 'idle' || !alignment ? '—' : score.netWpm} />
              <LiveMetric label="Accuracy" value={state === 'idle' || !alignment ? '—' : `${score.accuracy}%`} />
              <LiveMetric label={timed ? 'Time' : 'Elapsed'} value={timeDisplay} timer />
              <LiveMetric label="Words" value={`${wordsTyped(typed)}/${scoredReferenceWords}`} />
            </>
          )}
        </div>
      )}

      {!isFinished && <section aria-label="Typing practice" className="pt-2">
      {mode === 'free' && !isBlind && state === 'idle' && (
        <details className="reference-preview" key={reference}>
          <summary>Preview passage <span>{referenceWords} words</span></summary>
          <p>{reference}</p>
        </details>
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
              onClick={openCustomEditor}
              className="mt-4 gap-1.5"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste text
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'typing-surface glow-brand relative scroll-mt-20 flex cursor-text flex-col border px-4 py-5 shadow-sm transition-colors sm:px-8 sm:py-6',
            isPublic
              ? 'min-h-[260px] rounded-3xl sm:min-h-[315px]'
              : 'min-h-[235px] rounded-3xl sm:min-h-[305px]',
            'border-border-strong/65 focus-within:border-ring/65 focus-within:ring-2 focus-within:ring-ring/25'
          )}
        >
          {isBlind ? (
            <BlindTypingDisplay
              typed={typed}
              state={state}
              compact={!isPublic}
            />
          ) : (
            <div
              ref={viewportRef}
              className={cn(
                'relative mx-auto w-full overflow-hidden',
                passageType
              )}
              style={{ height: `${TYPING_VIEWPORT_HEIGHT_EM}em` }}
            >
              <div className={cn(passageBase, 'relative')}>
                {liveChars.chars.map((char, index) => (
                <span
                  key={index}
                  ref={char.state === 'current' ? currentCharRef : null}
                  className={cn(
                    char.state === 'untyped' && 'text-muted-foreground',
                    char.state === 'correct' && 'text-typing-correct',
                    char.state === 'wrong' && 'text-typing-incorrect',
                    char.state === 'wrong' && /\S/.test(char.ch) && 'typing-wrong',
                    char.state === 'current' &&
                      'bg-brand/10 text-foreground underline decoration-ring decoration-2 typing-current'
                  )}
                >
                  {char.ch}
                </span>
              ))}
              {liveChars.extras && (
                <span className="rounded-sm bg-typing-incorrect/10 text-typing-incorrect line-through">
                  {liveChars.extras}
                </span>
              )}
              {state === 'running' && typed.length >= reference.length && (
                <span
                  ref={currentCharRef}
                  className={cn(
                    'relative ml-0.5 -mb-1 inline-block w-[2.5px] animate-pulse bg-brand align-middle',
                    isPublic ? 'h-7 sm:h-8' : 'h-6 sm:h-7'
                  )}
                />
              )}
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isFinished || (mode === 'free' && passageLoading)}
            data-typing-input="true"
            className={cn(
              // A real, full-size input keeps mobile keyboards reliable.
              // It is transparent because the passage itself is the visual
              // surface; the caret is drawn by the passage spans.
              'absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent opacity-0 focus:outline-none',
              isFinished && 'pointer-events-none'
            )}
            aria-label="Typing input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
          />
        </div>
      )}
      </section>}

      {!canType ? null : !isFinished ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {(state === 'idle' || !timed) && <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {state === 'idle'
              ? timed ? 'Start typing to begin the countdown.' : 'Start typing when ready, or tap the passage to open your keyboard.'
              : mode === 'dictation' ? 'Finish and evaluate when ready, or press Enter.'
                : 'Finish the passage or choose Submit to see your score.'}
          </p>}

          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {state === 'running' && <Button
              variant="ghost"
              size="sm"
              onClick={() => { if (mode === 'free' || confirmDiscard()) restart(); }}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>}

            {mode === 'free' && state === 'idle' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={newFreePassage}
                disabled={passageLoading}
                className="gap-1.5 text-muted-foreground"
              >
                New passage
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}

            {state === 'running' && typed.length > 0 && (
              <Button
                size="sm"
                onClick={manualSubmit}
                className="gap-1.5"
              >
                {mode === 'dictation' ? 'Finish and evaluate' : 'Submit'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {hasReference && isFinished && alignment && (
        <div ref={resultRef}>
          <CompletionPanel
            score={score}
            elapsedSec={elapsedSec}
            mode={mode}
            counted={isCounted}
            public={isPublic}
            showReview={showModes || mode !== 'free'}
            onRetry={restart}
            onNewFree={mode === 'free' ? newFreePassage : undefined}
          />
        </div>
      )}

      {isFinished && (!hasReference || !alignment) && (
        <div
          ref={resultRef}
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-sm sm:p-6"
        >
          {(dictationScore.pending || alignmentPending) ? (
            <>
              <h2 className="text-base font-semibold text-foreground">
                {isCounted ? 'Attempt saved · preparing review…' : mode === 'dictation' ? 'Evaluating dictation…' : 'Scoring your attempt…'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isCounted ? 'Your score is available in Results.' : mode === 'dictation'
                  ? 'Keep this tab open. Your transcription stays here while we evaluate it.'
                  : 'Preparing your comparison.'}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">
                {isCounted ? 'Attempt saved. The comparison could not open.' : 'Could not score this attempt'}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dictationScore.error ?? (alignmentError === 'budget' ? 'This text exceeds the scoring budget.' : 'Could not calculate the passage review.')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isCounted && <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={mode === 'dictation' ? dictationScore.retry : restart}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {mode === 'dictation' ? 'Retry evaluation' : 'Try again'}
                </Button>}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => { if (confirmDiscard()) restart(); }}
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
          customBlind={draftBlind}
          setCustomBlind={setDraftBlind}
          onClose={() => setShowCustomDialog(false)}
          onApply={applyCustom}
        />
      )}

      {blindConfirm && (
        <BlindConfirmDialog
          action={blindConfirm}
          running={state === 'running'}
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
      aria-pressed={active}
      aria-label={locked ? `${label}. Sign in to unlock.` : label}
      title={locked ? `Sign in to use ${label.toLowerCase()}` : undefined}
      className={cn(
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2',
        compact
          ? 'flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center sm:flex-none sm:px-3.5'
          : 'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left',
        active
          ? 'bg-brand text-brand-foreground'
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
              className="hidden h-3 w-3 shrink-0 opacity-75 sm:block"
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
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [typed]);

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
      ref={viewport}
      className={cn(
        'mx-auto max-h-[min(48dvh,22rem)] w-full max-w-5xl flex-1 overflow-y-auto whitespace-pre-wrap break-words font-mono',
        compact
          ? 'text-xl leading-[1.8] sm:text-2xl sm:leading-[1.9] lg:text-[1.625rem]'
          : 'text-2xl leading-[2] sm:text-3xl sm:leading-[2.1]'
      )}
    >
      <span className="text-foreground">{typed}</span>
      {state === 'running' && (
        <span
          className={cn(
            'ml-0.5 -mb-1 inline-block w-[2.5px] animate-pulse bg-brand align-middle',
            compact ? 'h-6 sm:h-7' : 'h-7 sm:h-8'
          )}
        />
      )}
    </div>
  );
}

function LiveMetric({
  label,
  value,
  timer = false,
}: {
  label: string;
  value: string | number;
  timer?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p data-typing-clock={timer ? true : undefined} className={cn("truncate font-mono text-xl font-semibold tabular-nums sm:text-2xl", timer ? "text-brand" : "text-foreground")}>
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
  const [clipboardNotice, setClipboardNotice] = useState('');
  const check = inspectCustomText(customInput);
  const cleaned = check.text;
  const wordCount = check.words;
  const canStart = check.ok;

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCustomInput(text);
      setClipboardNotice(text ? 'Text pasted.' : 'The clipboard is empty.');
    } catch {
      setClipboardNotice('Clipboard access was unavailable. Paste into the text field directly.');
      textareaRef.current?.focus();
    }
  };

  return (
    <Modal title="Paste your own text" onClose={onClose} className="max-w-xl">
      <div className="p-4 sm:p-8">
        <div className="mb-3 flex items-start justify-between gap-2 sm:mb-6">
          <div>
            <h3 className="text-xl font-bold text-foreground">
              Paste your own text
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              English only. Line breaks and smart quotes are cleaned up so the
              score stays accurate.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <label htmlFor="custom-passage-editor" className="text-xs font-medium text-muted-foreground">Your text</label>
          <Button type="button" variant="outline" size="sm" onClick={pasteFromClipboard} className="gap-2">
            <ClipboardPaste className="size-4" aria-hidden />
            Paste from clipboard
          </Button>
        </div>
        <p role="status" className="mb-2 text-xs text-muted-foreground empty:hidden">{clipboardNotice}</p>

        <textarea
          ref={textareaRef}
          id="custom-passage-editor"
          aria-describedby="custom-passage-length"
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
          placeholder="Paste or type English text (at least 10 words)…"
          rows={10}
          className="max-h-[32dvh] w-full resize-y overflow-auto rounded-2xl border border-border bg-background p-3 font-mono text-base sm:max-h-[42dvh] sm:p-5 text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
        />

        <div id="custom-passage-length" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
          Hide reference while typing
        </label>

        <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-border bg-surface py-2 sm:mt-6 sm:pt-5">
          <Button variant="ghost" onClick={() => setCustomInput('')} disabled={!customInput}>Clear</Button>
          <Button variant="outline" onClick={onClose} className="rounded-full px-4 sm:px-6">
            Cancel
          </Button>
          <Button onClick={onApply} disabled={!canStart} className="rounded-full px-4 sm:px-6">
            Start
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BlindConfirmDialog({
  action,
  running,
  onCancel,
  onConfirm,
}: {
  action: 'enable' | 'disable';
  running: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const enabling = action === 'enable';

  return (
    <Modal labelledBy="blind-confirm-title" onClose={onCancel}>
      <div className="p-5 sm:p-6">
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
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {enabling
            ? 'The passage will be hidden while you type.'
            : 'The passage will be visible while you type.'}
        </p>
        {running && <p className="mt-3 rounded-2xl border border-warning/25 bg-warning/[0.05] px-3 py-2 text-xs text-foreground">
          This restarts your active attempt.
        </p>}

        <div className="sticky bottom-0 mt-4 flex flex-wrap justify-end gap-2 border-t border-border bg-surface py-2 sm:mt-6 sm:pt-5">
          <Button
            variant="outline"
            onClick={onCancel}

          >
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            {enabling ? 'Enable blind mode' : 'Show the passage'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
