'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  X,
  Type,
  Headphones,
  Eye,
  EyeOff,
  Sparkles,
  ClipboardPaste,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  computeScore,
  buildCharacterMap,
  applyBackspace,
  type CharacterMap,
} from '@/lib/scoring';
import { generatePassage, recommendDuration } from '@/lib/passage-generator';
import { mockDictations } from '@/lib/dictation-transcripts';
import { sanitizeForTyping } from '@/lib/sanitize';
import {
  addSessionResult,
  getSessionResults,
  subscribeSessionResults,
  clearSessionResults,
  type SessionResult,
} from '@/lib/session-results';

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

/**
 * Free-mode passages are generated to ~75 words (always 50–100) by
 * `lib/passage-generator.ts`. Dictation/custom passages are
 * content-driven.
 */

export type TypingClientProps = {
  /**
   * Which entrypoint is rendering this client.
   *  - 'public'  : the marketing/home page — free mode only, no mode tabs
   *  - 'student' : full free + dictation + custom experience
   */
  variant?: 'public' | 'student';
  /** Initial mode to render. Defaults to 'free'. */
  initialMode?: Mode;
  /**
   * Optional dictation ID to preselect (only meaningful in
   * dictation mode). Used when deep-linking from
   * /student/dashboard "Resume practice" etc.
   */
  initialDictationId?: string;
  /**
   * Whether the visitor is signed in. On the home page this comes
   * from the server (no client flash). Blind dictation and custom
   * paste are members-only: guests see the tabs, but using them
   * redirects to /login. Defaults to true (student area is gated
   * by the proxy anyway).
   */
  authenticated?: boolean;
};

export default function TypingClient({
  variant = 'public',
  initialMode = 'free',
  initialDictationId,
  authenticated = true,
}: TypingClientProps) {
  const showModes = variant === 'student';
  const isPublic = variant === 'public';
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [duration, setDuration] = useState<Duration>(30);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [category, setCategory] = useState<Category>('mixed');

  // Dictation
  const [dictationId, setDictationId] = useState(
    initialDictationId && mockDictations.some((d) => d.id === initialDictationId)
      ? initialDictationId
      : mockDictations[0].id
  );
  const dictation = mockDictations.find((d) => d.id === dictationId)!;

  // Custom
  const [customText, setCustomText] = useState<string>('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [customBlind, setCustomBlind] = useState(false);

  // Free
  const [passage, setPassage] = useState<string>('');

  // Test state
  const [typed, setTyped] = useState('');
  const [state, setState] = useState<TestState>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showReference, setShowReference] = useState(true);
  /** Which blind-mode confirmation the student is being asked to approve. */
  const [blindConfirm, setBlindConfirm] = useState<null | 'enable' | 'disable'>(
    null
  );
  /**
   * Whether the *current* run was started with the passage hidden.
   * Only blind runs are counted; a run that started with the passage
   * visible is practice only.
   */
  const [runBlind, setRunBlind] = useState(false);
  /**
   * Reference preview inside blind mode. While previewing, typing is
   * paused and the passage is visible; the first keystroke returns to
   * blind typing, but the run is flagged as uncounted.
   */
  const [peeking, setPeeking] = useState(false);
  /** Render-safe mirror of `peekedRef` for the current attempt. */
  const [peekedThisRun, setPeekedThisRun] = useState(false);
  /** Seconds elapsed since the test went 'running' — for untimed modes (dictation/custom). */
  const [untimedElapsed, setUntimedElapsed] = useState(0);
  /**
   * Total wrong keystrokes this attempt — the honest error count.
   * It NEVER decreases on backspace: correcting a mistake improves
   * accuracy, but the mistake still happened. One definition of
   * "errors" is used everywhere (live strip, result panel, results).
   */
  const [errorTally, setErrorTally] = useState(0);

  /**
   * Hard gate: on the public page, blind dictation and custom paste
   * are members-only. The lock icon + "/login" click is the UI; this
   * effect is the enforcement — even if `mode` is tampered with via
   * DevTools, extensions, or any client-side manipulation, it is
   * reverted to free immediately and no dictation/custom content is
   * ever loaded.
   */
  useEffect(() => {
    if (isPublic && !authenticated && mode !== 'free') {
      setMode('free');
      setTyped('');
      setShowReference(true);
      setRunBlind(false);
      setCustomText('');
      setCustomInput('');
      setErrorTally(0);
      setStartTime(null);
      setState('idle');
      setTimeLeft(duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic, authenticated, mode]);

  const inputRef = useRef<HTMLInputElement>(null);
  const currentCharRef = useRef<HTMLSpanElement | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const typingAreaRef = useRef<HTMLDivElement>(null);
  /** Prevents recording the same completed attempt twice. */
  const recordedRef = useRef(false);
  /** Mirror of `typed` for the global keydown listener — avoids
   *  re-binding the window listener on every keystroke. */
  const typedRef = useRef<string>('');
  /** Mirror of `showReference` so the global keydown listener can
   *  record whether a run began in blind mode. */
  const referenceVisibleRef = useRef<boolean>(true);
  /** True once the student has previewed the reference during this run. */
  const peekedRef = useRef<boolean>(false);
  /** Mirror of `peeking` for the global keydown listener. */
  const peekingRef = useRef<boolean>(false);

  const freshPassage = useCallback(
    (cat: Category) => generatePassage({ category: cat, targetWords: 75 }),
    []
  );

  /* ─── Derived reference per mode ────────────────────────── */
  const reference = useMemo(() => {
    if (mode === 'dictation') {
      if (isPublic && !authenticated) return '';
      return dictation.referenceTranscript;
    }
    if (mode === 'custom') {
      if (isPublic && !authenticated) return '';
      return customText;
    }
    return passage;
  }, [mode, dictation, customText, passage, isPublic, authenticated]);

  /* ─── Mode / category / dictation / customText changes ────
   *
   * Initial mount: generate the first free-mode passage.
   * Category change: regenerate the passage *only while idle* so
   * we never wipe an in-progress test. Once the user is typing,
   * category changes are deferred until they hit "New passage"
   * or restart — same UX as a category filter on a curated pool.
   */
  useEffect(() => {
    if (mode === 'free' && !passage) {
      setPassage(freshPassage(category));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== 'free') return;
    if (state !== 'idle') return;
    setPassage(freshPassage(category));
    setTyped('');
    setStartTime(null);
    setErrorTally(0);
    if (timed) setTimeLeft(duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    setTyped('');
    setState('idle');
    setStartTime(null);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    setErrorTally(0);

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
    // `category` is deliberately excluded: changing the category while
    // idle must not silently switch blind mode back off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dictationId, customText, customBlind]);

  /* ─── Duration changes ──────────────────────────────────── */
  useEffect(() => {
    setTyped('');
    setState('idle');
    setStartTime(null);
    setTimeLeft(duration);
    setErrorTally(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [duration]);

  /* ─── Timer (only meaningful for free mode; dictation/custom are untimed) ─── */
  const timed = mode === 'free';
  useEffect(() => {
    if (state !== 'running' || !timed) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setState('complete');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state, timed]);

  /* ─── Elapsed-time counter for untimed modes (dictation / custom) ─── */
  useEffect(() => {
    if (state !== 'running' || timed) return;
    setUntimedElapsed(0);
    const id = setInterval(() => {
      setUntimedElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state, timed]);

  /* ─── Auto-complete (any mode once the passage is fully typed) ───
   * Submits immediately when the final word is fully typed —
   * trailing punctuation (a closing period etc.) is optional, and
   * completing the passage before the timer runs out ends the test
   * early instead of holding you hostage. */
  useEffect(() => {
    if (state !== 'running') return;
    if (!reference) return;
    if (typed.length >= reference.length) {
      setState('complete');
      return;
    }
    // Forgiving finish: all words typed and the last one matches the
    // passage's final word (punctuation-stripped) → done.
    const refWords = reference.trim().split(/\s+/).filter(Boolean);
    const typedWords = typed.trim().split(/\s+/).filter(Boolean);
    if (typedWords.length >= refWords.length && refWords.length > 0) {
      const lastRef = (refWords[refWords.length - 1] ?? '').replace(
        /[.,;:!?…]+$/,
        ''
      );
      const lastTyped = typedWords[typedWords.length - 1] ?? '';
      if (lastTyped.length > 0 && lastTyped === lastRef) {
        setState('complete');
      }
    }
  }, [typed, state, reference]);

  /* ─── Manual submit ───────────────────────────────────────
   * Ends the run early in ANY mode while it is still running —
   * in free mode you are no longer locked to the timer: submit
   * whatever you have typed so far when you want to stop. */
  const manualSubmit = useCallback(() => {
    if (state !== 'running') return;
    setState('complete');
  }, [state]);

  /* ─── Scroll the current caret into view inside the typing area ─── */
  useLayoutEffect(() => {
    if (state !== 'running') return;
    if (!currentCharRef.current) return;
    currentCharRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [typed, state]);

  /* ─── Auto-scroll the typing area into view on mode/dictation/passage change ─── */
  useEffect(() => {
    // Only scroll when there's a passage ready and the test hasn't started.
    if (!reference || state !== 'idle') return;
    requestAnimationFrame(() => {
      typingAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dictationId, customText, category]);

  /* ─── Auto-scroll to the result panel on completion ─────── */
  useEffect(() => {
    if (state !== 'complete') return;
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [state]);

  /* ─── Input handling ────────────────────────────────────── */
  const startIfIdle = () => {
    if (state === 'idle') {
      setState('running');
      setStartTime(Date.now());
      // Snapshot the blind state: only runs that start hidden — and
      // never previewed the passage — count.
      setRunBlind(!referenceVisibleRef.current && !peekedRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // The global listener already handles typing-input keystrokes
    // (with preventDefault). Skip if already processed.
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') e.preventDefault();
    // Tab = restart (Monkeytype-style): same passage, fresh attempt.
    if (e.key === 'Tab') {
      e.preventDefault();
      restart();
      return;
    }
    if (state === 'complete') return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      startIfIdle();
      setTyped(applyBackspace(typed));
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (state === 'complete' || !reference) return;
    const value = e.target.value;
    startIfIdle();
    if (value.length > reference.length) {
      e.target.value = typed;
      return;
    }
    // Honest error counting: every newly appended character that
    // mismatches the reference increments the tally — backspace
    // never removes a recorded mistake.
    const pos = typed.length;
    if (value.length > pos && reference[pos] !== value[pos]) {
      setErrorTally((n) => n + 1);
    }
    setTyped(value);
  };

  /**
   * Paste is blocked inside the test — pasting (part of) the visible
   * reference would be an instant 100% score. Own text enters only
   * through the custom-text dialog, which is the sanctioned path.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  /* ─── Global keyboard capture ─────────────────────────────
     Lets the user start typing immediately, without first
     having to click on the typing area. The hidden <input>
     is now used only for paste support (paste events only
     fire on focused inputs). Typing flows through the
     window listener below.

     If the user has focused a real text-entry control
     (input, textarea, select, contenteditable) — e.g. the
     custom-text dialog — we skip our handler entirely so the
     focused control receives the keystroke normally. */
  useEffect(() => {
    if (state === 'complete') return;
    if (!reference) return;

    const isEditableTarget = (el: Element | null): boolean => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // The typing engine's hidden <input> is handled by the global
        // listener below — do not skip it, otherwise typing never
        // starts without a manual click on the typing area.
        if ((el as HTMLInputElement).dataset?.typingInput === 'true') {
          return false;
        }
        return true;
      }
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack the custom-text dialog or any real form input.
      if (isEditableTarget(document.activeElement)) return;
      // Don't hijack modifier combos (Ctrl/Cmd/Alt + key) — let
      // the browser handle shortcuts like Ctrl+R, Cmd+L, etc.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Only intercept keys when we're in a state that accepts input.
      if (state !== 'idle' && state !== 'running') return;

      // While previewing the reference, the first keystroke drops back
      // to blind typing. The preview has already tainted this run, so
      // `peekedRef` stays true and the attempt won't be counted.
      if (peekingRef.current) {
        setPeeking(false);
        peekedRef.current = true;
      }

      // Backspace — handled by our state machine, not the input.
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (state === 'idle') {
          setState('running');
          setStartTime(Date.now());
          setRunBlind(!referenceVisibleRef.current && !peekedRef.current);
        }
        setTyped(applyBackspace(typedRef.current));
        return;
      }

      // Skip other non-printable / control keys (Arrow*, Tab,
      // Escape, Function keys, etc.) — the user is navigating,
      // not typing.
      if (e.key.length !== 1) return;
      // Don't accept newlines / tabs as typing input.
      if (e.key === '\n' || e.key === '\t') return;

      // Printable character: append it to the typed string.
      e.preventDefault();
      const current = typedRef.current;
      if (current.length >= reference.length) return;
      if (state === 'idle') {
        setState('running');
        setStartTime(Date.now());
        setRunBlind(!referenceVisibleRef.current && !peekedRef.current);
      }
      // Honest error counting — a wrong keystroke is recorded even if
      // the student immediately backspaces it.
      if (reference[current.length] !== e.key) {
        setErrorTally((n) => n + 1);
      }
      setTyped(current + e.key);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reference]);

  /* ─── Scoring ───────────────────────────────────────────── */
  const elapsedSec = timed
    ? startTime
      ? Math.max(0, duration - timeLeft)
      : 0
    : untimedElapsed;
  // eslint-disable-next-line react-hooks/refs -- mirrors state into a ref for stale-closure-free keydown handlers
  typedRef.current = typed;
  // eslint-disable-next-line react-hooks/refs -- see above
  referenceVisibleRef.current = showReference;
  // eslint-disable-next-line react-hooks/refs -- see above
  peekingRef.current = peeking;
  const score = useMemo(
    () => computeScore(reference, typed, elapsedSec * 1000),
    [reference, typed, elapsedSec]
  );
  const charMap: CharacterMap = useMemo(
    () => buildCharacterMap(reference, typed, state === 'complete'),
    [reference, typed, state]
  );

  /* ─── Reset / regenerate ────────────────────────────────── */
  const restart = useCallback(() => {
    setTyped('');
    setState('idle');
    setStartTime(null);
    setRunBlind(false);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    setErrorTally(0);
    if (timed) setTimeLeft(duration);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [duration, timed]);

  const newFreePassage = useCallback(() => {
    setPassage(freshPassage(category));
    setTyped('');
    setState('idle');
    setStartTime(null);
    setRunBlind(false);
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    setErrorTally(0);
    setTimeLeft(duration);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [category, duration, freshPassage]);

  /**
   * Apply a confirmed blind-mode change. The current attempt is
   * discarded: toggling mid-run would let a student reveal the
   * passage and keep the score.
   */
  const applyBlindMode = useCallback(
    (blind: boolean) => {
      // Blind dictation is members-only on the home page.
      if (isPublic && !authenticated) return;
      setShowReference(!blind);
      // Keep custom mode's own blind flag in sync with the toggle.
      if (mode === 'custom') setCustomBlind(blind);
      setBlindConfirm(null);
      setTyped('');
      setState('idle');
      setStartTime(null);
      setRunBlind(false);
      setPeeking(false);
      peekedRef.current = false;
    setPeekedThisRun(false);
      setErrorTally(0);
      setUntimedElapsed(0);
      if (timed) setTimeLeft(duration);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [duration, timed, mode]
  );

  /**
   * Preview the reference while in blind mode. This restarts the
   * attempt and taints it: any run that follows a peek is practice
   * only, so peeking can't be used to memorise and then score.
   */
  const peekAtReference = useCallback(() => {
    setPeeking(true);
    setPeekedThisRun(true);
    peekedRef.current = true;
    setTyped('');
    setState('idle');
    setStartTime(null);
    setRunBlind(false);
    setErrorTally(0);
    setUntimedElapsed(0);
    if (timed) setTimeLeft(duration);
  }, [duration, timed]);

  const stopPeeking = useCallback(() => {
    setPeeking(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const applyCustom = () => {
    // Blind dictation and custom paste are members-only on the home
    // page — even via DevTools this path must not succeed without a
    // valid session (the mode lock reverts it too).
    if (isPublic && !authenticated) return;
    const text = sanitizeForTyping(customInput);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words < 10) return;
    setCustomText(text);
    setCustomInput('');
    setShowCustomDialog(false);
    setMode('custom');
    setPeeking(false);
    peekedRef.current = false;
    setPeekedThisRun(false);
    setErrorTally(0);
    const rec = recommendDuration(text);
    setDuration(rec);
    setTimeLeft(rec);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /* ─── Record the finished attempt in the session-only store ───
   * These results survive navigation but are wiped on refresh.
   * No database write happens here. */
  useEffect(() => {
    if (state !== 'complete') {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    if (!reference) return;
    recordedRef.current = true;

    // Correct words — computed inline (same rule as the live counter):
    // position-wise word match against the reference, no cascade.
    const refWords = reference.trim().split(/\s+/).filter(Boolean);
    const typedWords = typed.trim().split(/\s+/).filter(Boolean);
    let correctWordCount = 0;
    for (
      let i = 0;
      i < Math.min(refWords.length, typedWords.length);
      i++
    ) {
      if (refWords[i] === typedWords[i]) correctWordCount++;
    }

    addSessionResult({
      id: `${Date.now()}`,
      practice:
        mode === 'dictation'
          ? dictation.title
          : mode === 'custom'
          ? 'Custom passage'
          : 'Free typing',
      category: mode === 'dictation' ? dictation.category : 'General',
      wpm: score.wpm,
      rawWpm: score.rawWpm,
      accuracy: score.accuracy,
      correctWords: correctWordCount,
      totalWords: refWords.length,
      errors: errorTally,
      duration: `${Math.floor(elapsedSec / 60)}:${String(
        elapsedSec % 60
      ).padStart(2, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      mode,
      counted: runBlind,
    });
  }, [state, reference, typed, mode, dictation, score, elapsedSec, runBlind, errorTally]);

  /* ─── Display helpers ───────────────────────────────────── */
  const timeDisplay = `${String(Math.floor(timeLeft / 60)).padStart(1, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;
  const isFinished = state === 'complete';
  const isBlind = !showReference;
  /** Reference preview is only meaningful while blind mode is on. */
  const isPeeking = showModes && peeking && isBlind;
  /** Only runs that started hidden and never peeked are counted. */
  const isCounted = isFinished && runBlind;
  const hasReference = reference.length > 0;

  /** Word count for display — more useful than raw character counts. */
  const wordsTyped = (text: string) =>
    text.trim().split(/\s+/).filter((w) => w.length > 0).length;

  /** Correct word count for display (word-by-word match, no cascade). */
  const correctWords = () => {
    const pw = reference.trim().split(/\s+/).filter((w) => w.length > 0);
    const tw = typed.trim().split(/\s+/).filter((w) => w.length > 0);
    let correct = 0;
    const len = Math.min(pw.length, tw.length);
    for (let i = 0; i < len; i++) {
      if (pw[i] === tw[i]) correct++;
    }
    return correct;
  };

  return (
    <div className="space-y-6">
      {!isPublic && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800 font-medium">
            🚧 Results are session-only — not stored.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            You can finish up to 5 tests without refreshing and see each score
            on this visit. Everything is cleared on refresh until the database
            is connected.
          </p>
        </div>
      )}

      {/* Public (Monkeytype-style): mode tabs in the same style as the
          student page, then categories + durations for free mode.
          Blind dictation and custom paste are members-only — guests
          see them locked and are sent straight to /login. */}
      {isPublic && (
        <div className="flex items-center justify-between gap-4 flex-nowrap">
          {/* Mode tabs (compact, student-page style) */}
          <div
            className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5"
            role="tablist"
            aria-label="Typing mode"
          >
            <ModeTab
              active={mode === 'free' && !isBlind}
              onClick={() => {
                if (isBlind) setShowReference(true);
                setMode('free');
              }}
              icon={Sparkles}
              label="Free"
              hint="Curated"
            />
            {authenticated ? (
              <ModeTab
                active={mode === 'dictation'}
                onClick={() => setMode('dictation')}
                icon={Headphones}
                label="Dictation"
                hint="Blind"
              />
            ) : (
              <ModeTab
                active={false}
                onClick={() => router.push('/login')}
                icon={Lock}
                label="Dictation"
                hint="For sign in"
              />
            )}
            {authenticated ? (
              <ModeTab
                active={mode === 'custom'}
                onClick={() => {
                  if (!customText) setShowCustomDialog(true);
                  else setMode('custom');
                }}
                icon={ClipboardPaste}
                label="Custom"
                hint="Your text"
              />
            ) : (
              <ModeTab
                active={false}
                onClick={() => router.push('/login')}
                icon={Lock}
                label="Custom"
                hint="For sign in"
              />
            )}
          </div>

          {/* Categories + durations grouped together */}
          {mode === 'free' && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-0.5">
              <div className="flex items-center gap-1">
                  {CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        aria-pressed={active}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                          active
                            ? 'bg-brand text-brand-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <div className="h-5 w-px bg-border mx-1" aria-hidden="true" />
                <div className="flex items-center gap-0.5">
                  {DURATIONS.map((d) => {
                    const active = duration === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        aria-pressed={active}
                        className={cn(
                          'min-w-[3rem] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                          active
                            ? 'bg-brand text-brand-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {d}s
                      </button>
                    );
                  })}
                </div>
              </div>
          )}

          <RecentRuns />
        </div>
      )}

      {/* Header row — title on the left, mode tabs (student only) on the right */}
      {!isPublic && (
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Type className="h-4 w-4 text-brand" strokeWidth={1.5} />
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {mode === 'dictation'
              ? 'Dictation'
              : mode === 'custom'
              ? 'Custom passage'
              : 'Typing test'}
          </h1>
        </div>

        {showModes && (
          <div
            className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-0.5"
            role="tablist"
            aria-label="Typing mode"
          >
            <ModeTab
              active={mode === 'free'}
              onClick={() => setMode('free')}
              icon={Sparkles}
              label="Free"
              hint="Curated"
            />
            <ModeTab
              active={mode === 'dictation'}
              onClick={() => setMode('dictation')}
              icon={Headphones}
              label="Dictation"
              hint="Blind"
            />
            <ModeTab
              active={mode === 'custom'}
              onClick={() => {
                if (!customText) setShowCustomDialog(true);
                else setMode('custom');
              }}
              icon={ClipboardPaste}
              label="Custom"
              hint="Your text"
            />
          </div>
        )}

        {showModes && (
          <button
            type="button"
            onClick={() => setBlindConfirm(isBlind ? 'disable' : 'enable')}
            aria-pressed={isBlind}
            title={
              isBlind
                ? 'Blind mode is on — the passage is hidden and results are counted.'
                : 'Blind mode is off — the passage is visible and this run is practice only.'
            }
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
              isBlind
                ? 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/15'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground'
            )}
          >
            {isBlind ? (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            <span>
              Blind mode{' '}
              <span className="font-mono">{isBlind ? 'on' : 'off'}</span>
            </span>
          </button>
        )}

        {mode === 'free' && (
          <div
            className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
            role="group"
            aria-label="Test duration"
          >
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  aria-pressed={active}
                  className={cn(
                    'min-w-[3rem] rounded px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-brand text-brand-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {d}s
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Categories — only relevant in free mode (public has its own
          compact config row above) */}
      {mode === 'free' && !isPublic && (
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-0.5">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                aria-pressed={active}
                className={cn(
                  'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Dictation / custom context row — same panel on home and student
          (only reachable when signed in on the home page). */}
      {mode !== 'free' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {mode === 'dictation' && (
            <ControlCard>
              <SmallLabel>Dictation</SmallLabel>
              <select
                value={dictationId}
                onChange={(e) => setDictationId(e.target.value)}
                className={selectClass}
              >
                {mockDictations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} —{' '}
                    {
                      d.referenceTranscript.trim().split(/\s+/).filter(Boolean)
                        .length
                    }{' '}
                    words
                  </option>
                ))}
              </select>
              {isBlind ? (
                <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand">
                  <EyeOff className="h-3 w-3" />
                  Blind mode — counted
                </span>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
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
                  onClick={() => setShowCustomDialog(true)}
                  className="rounded-md px-2 py-0.5 text-xs font-medium text-brand hover:bg-brand/10"
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
                    {customText.trim().split(/\s+/).filter(Boolean).length}{' '}
                    {customText.trim().split(/\s+/).filter(Boolean).length === 1
                      ? 'word'
                      : 'words'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No text yet — paste or type your own passage.
                </p>
              )}
              {customText &&
                (isBlind ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand">
                    <EyeOff className="h-3 w-3" />
                    Blind mode — counted
                  </span>
                ) : (
                  <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    Reference visible — practice only
                  </span>
                ))}
            </ControlCard>
          )}

          <ControlCard>
            <SmallLabel>Mode</SmallLabel>
            <p className="text-sm text-foreground">
              {isPeeking
                ? 'Reference preview — typing is paused. Start typing to go blind again; this run will not be counted.'
                : isBlind
                ? 'Blind mode — type from memory, submit when ready. This run counts.'
                : 'Type at your own pace — submits when you finish. Practice run, not counted.'}
            </p>
            {!isFinished && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setBlindConfirm(isBlind ? 'disable' : 'enable')}
                  className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
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
                {isBlind && !isPeeking && (
                  <button
                    onClick={peekAtReference}
                    className="inline-flex items-center gap-1.5 self-start rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-warning/20"
                    title="Look at the passage now. This restarts the attempt and it will not be counted."
                  >
                    <Eye className="h-3 w-3" /> Peek at reference
                  </button>
                )}
              </div>
            )}
          </ControlCard>
        </div>
      )}

      {/* Live stats — public gets a slim Monkeytype-style line that only
          appears while typing; students get the full metric card. */}
      {isPublic ? (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="min-h-7 font-mono text-sm tabular-nums text-muted-foreground"
        >
          {state === 'running' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span>
                <span className="text-lg font-semibold text-foreground">
                  {score.wpm}
                </span>{' '}
                wpm
              </span>
              <span>
                <span className="text-lg font-semibold text-foreground">
                  {score.accuracy}%
                </span>{' '}
                accuracy
              </span>
              <span>{timeDisplay}</span>
              <span className="ml-auto">
                {wordsTyped(typed)}/{wordsTyped(reference)} words
              </span>
            </div>
          )}
        </div>
      ) : (
      <div
        className="rounded-lg border border-border bg-surface px-5 py-4"
        aria-live="polite"
        aria-atomic="true"
      >
        {showModes && (
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
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
                  <span className="text-brand">Blind mode — counted</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Practice — not scored
                  </span>
                </>
              )}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {isBlind && !isFinished ? (
            <>
              <MetricCell label="typed" value={wordsTyped(typed)} />
              <MetricCell
                label={timed ? 'time' : 'elapsed'}
                value={`${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`}
              />
              <MetricCell label="accuracy" value="—" muted />
              <MetricCell label="errors" value="—" muted />
            </>
          ) : (
            <>
              <MetricCell label="wpm" value={score.wpm} />
              <MetricCell label="accuracy" value={`${score.accuracy}%`} />
              <MetricCell
                label="correct"
                value={`${correctWords()} / ${wordsTyped(reference)} words`}
              />
              <MetricCell label="errors" value={errorTally} muted />
              <MetricCell
                label={timed ? 'time' : 'elapsed'}
                value={`${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`}
              />
            </>
          )}
        </div>
        {isBlind && !isFinished && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            No live feedback in blind mode — accuracy, errors and the
            character-by-character comparison appear when you submit.
          </p>
        )}
      </div>
      )}

      {/* Typing area */}
      {!hasReference ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/30 px-6 py-20 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'custom'
              ? 'Paste a passage to start.'
              : 'No passage available.'}
          </p>
          {showModes && mode === 'custom' && (
            <Button
              onClick={() => setShowCustomDialog(true)}
              className="mt-4 gap-1.5"
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
            'cursor-text flex flex-col',
            'rounded-3xl border border-border bg-surface px-4 py-6 transition-colors sm:px-6 sm:py-10 min-h-[50vh] sm:min-h-[50vh]',
            isBlind
              ? 'border-brand/30 ring-1 ring-brand/15 focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/30'
              : 'border-border focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/20'
          )}
          onClick={(e) => {
            e.preventDefault();
            startIfIdle();
            inputRef.current?.focus();
          }}
          role="textbox"
          aria-label={
            isBlind ? 'Typing area (blind mode)' : 'Typing passage'
          }
          tabIndex={0}
          onKeyDown={(e) => {
            // Tab = restart, Monkeytype-style — works whether or not
            // the hidden input currently holds focus.
            if (e.key === 'Tab') {
              e.preventDefault();
              restart();
              return;
            }
            if (e.key === ' ' || e.key === 'Backspace') {
              inputRef.current?.focus();
            }
          }}
        >
          {/* Header strip */}
          {!isPublic && (
          <div className="mb-4 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {isPeeking ? (
                <>
                  <Eye className="h-3 w-3 text-warning" />
                  Reference preview — typing paused
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
                : `${correctWords()}/${wordsTyped(reference)} correct`}
            </span>
          </div>
          )}

          {/* The actual passage — two render modes:
       • See mode  : show the full reference with per-character
                     correct / wrong / untyped coloring.
       • Blind mode: show ONLY what the student has typed so far
                     (green for correct, red for wrong). The
                     reference ahead is never rendered, so the
                     student truly types from memory / shorthand.
                     After completion the dedicated review block
                     in CompletionPanel surfaces everything. */}
          {isPeeking ? (
            <PeekDisplay reference={reference} onDone={stopPeeking} />
          ) : isBlind ? (
            <BlindTypingDisplay typed={typed} state={state} />
          ) : (
            <div className="mx-auto w-full max-w-5xl flex-1 font-mono text-2xl leading-[2] sm:text-3xl sm:leading-[2.1] whitespace-pre-wrap break-words">
              {charMap.map((s, i) => {
                const ch = reference[i] ?? '';
                const isCurrent = s === 'current';
                return (
                  <span
                    key={i}
                    ref={isCurrent ? currentCharRef : null}
                    className={cn(
                      'transition-colors duration-75',
                      isCurrent && 'relative',
                      s === 'untyped' && 'text-muted-foreground/40',
                      s === 'correct' && 'text-success',
                      s === 'incorrect' && 'text-destructive',
                      s === 'current' &&
                        'text-foreground border-b-2 border-brand bg-brand/15 rounded-sm'
                    )}
                  >
                    {ch === ' ' && s === 'incorrect' ? '\u00A0' : ch}
                  </span>
                );
              })}
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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

      {/* Status line + actions */}
      {!hasReference ? null : !isFinished ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isPeeking
              ? 'Read the passage, then start typing to go blind again. This run is not counted.'
              : state === 'idle'
              ? isBlind
                ? 'Click the typing area and start. The progress counter begins on your first keypress.'
                : 'Click the typing area and start. The timer begins on your first keypress.'
              : null}
            {!isPeeking && state === 'running' &&
              (timed
                ? 'Type naturally — speed will follow.'
                : 'Keep going — submission is automatic when you finish.')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </Button>
            {mode === 'free' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={newFreePassage}
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
                Submit
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Completion panel — auto-scrolled into view above */}
      {hasReference && isFinished && (
        <div ref={resultRef}>
          <CompletionPanel
            score={score}
            elapsedSec={elapsedSec}
            reference={reference}
            typed={typed}
            mode={mode}
            counted={isCounted}
            peeked={peekedThisRun}
            errors={errorTally}
            correctWords={correctWords()}
            totalWords={wordsTyped(reference)}
            public={isPublic}
            showReview={showModes || mode !== 'free'}
            onRetry={restart}
            onNewFree={mode === 'free' ? newFreePassage : undefined}
          />
        </div>
      )}

      {/* Custom-text dialog (all variants — home custom pill opens it) */}
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

      {/* Blind-mode confirmation */}
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

/* ─── Sub-components ─────────────────────────────────────── */

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-left transition-colors',
        active
          ? 'bg-brand text-brand-foreground'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p
          className={cn(
            'truncate text-[11px]',
            active ? 'text-brand-foreground/70' : 'text-muted-foreground'
          )}
        >
          {hint}
        </p>
      </div>
    </button>
  );
}

/**
 * Blind typing display — shows ONLY what the student has typed so far,
 * color-coded correct (green) / wrong (red). The reference ahead is
 * never rendered, so the student is genuinely typing from memory
 * or from their shorthand notes.
 *
 * The full diff (typed + missed + overflow) is surfaced separately
 * in CompletionPanel.ReviewBlock once the test completes.
 */
function BlindTypingDisplay({
  typed,
  state,
}: {
  typed: string;
  state: TestState;
}) {
  if (state === 'idle' && typed.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
        <EyeOff className="mb-3 h-7 w-7 text-brand/60" strokeWidth={1.5} />
        <p className="text-base font-medium text-foreground">
          Reference hidden
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Type from memory or from your shorthand. Your characters appear here
          as you type — no live feedback. The full comparison opens when you
          submit.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 font-mono text-2xl leading-[2] sm:text-3xl sm:leading-[2.1] whitespace-pre-wrap break-words">
      {/*
        Deliberately NO per-character correctness colouring here.
        While the reference is hidden, showing red/green as you type
        turns the exercise into a guided copy test. The student sees
        exactly what they typed, and the red/green diff is revealed
        only after submission in CompletionPanel.
      */}
      <span className="text-foreground">{typed}</span>
      {state === 'running' && (
        <span className="ml-0.5 inline-block h-7 w-[2px] -mb-1 animate-pulse bg-brand align-middle sm:h-8" />
      )}
    </div>
  );
}

/**
 * Reference preview for blind mode. The passage is shown read-only and
 * typing is paused; leaving the preview returns to blind typing. The
 * run is flagged as uncounted either way, so peeking can't feed a score.
 */
function PeekDisplay({
  reference,
  onDone,
}: {
  reference: string;
  onDone: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
        <p className="text-xs text-foreground">
          <span className="font-medium">Reference preview.</span> Typing is
          paused. Start typing to go blind again — this run will{' '}
          <span className="font-medium">not</span> be counted.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onDone}
          className="gap-1.5"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Back to blind
        </Button>
      </div>
      <div className="font-mono text-xl leading-[1.9] whitespace-pre-wrap break-words text-foreground/90 sm:text-2xl">
        {reference}
      </div>
    </div>
  );
}

function ControlCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
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
  'h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20';

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
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'font-mono text-3xl font-semibold tabular-nums tracking-tight',
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
  setCustomInput: (v: string) => void;
  customBlind: boolean;
  setCustomBlind: (v: boolean) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleaned = sanitizeForTyping(customInput);
  const wordCount = cleaned.trim().split(/\s+/).filter(Boolean).length;
  const canStart = wordCount >= 10;

  useEffect(() => {
    // Focus the textarea so the user can paste/type immediately.
    requestAnimationFrame(() => textareaRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCustomInput(text);
    } catch {
      // Clipboard permission denied — the textarea still accepts Ctrl/Cmd+V.
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
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Paste your own text
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              English only. Line breaks and smart quotes are cleaned up so the
              score stays accurate.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Your text
          </span>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ClipboardPaste className="h-3 w-3" />
            Paste from clipboard
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Paste or type English text (at least 10 words)…"
          rows={8}
          className="max-h-64 w-full resize-y overflow-auto rounded-md border border-border bg-background p-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · min 10
          </span>
          {canStart && (
            <span className="text-success">
              ~{recommendDuration(cleaned)}s suggested
            </span>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={customBlind}
            onChange={(e) => setCustomBlind(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-background accent-brand"
          />
          Hide reference (type from memory — counted)
        </label>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={!canStart}>
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmation gate for blind mode.
 *
 * Blind mode changes what the run is worth, so flipping it is an
 * explicit, acknowledged action: enabling hides the passage and makes
 * the run count; disabling reveals it and downgrades the run to
 * practice. Either way the current attempt is restarted.
 */
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
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
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
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
              className="text-base font-semibold text-foreground"
            >
              {enabling ? 'Enable blind mode?' : 'Turn off blind mode?'}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {enabling
            ? 'The passage will be hidden and you will type from memory. Only blind runs are counted.'
            : 'The passage will be visible while you type. Runs with the passage visible are practice only and are not counted.'}
        </p>
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Your current attempt will be restarted.
        </p>

        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            {enabling ? 'Enable blind mode' : 'Show the passage'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Result panel — verdict, stats, and (only for dictation/custom)
 * a single-pass review that shows the typed text in red for wrong
 * characters and the missed tail of the reference in a muted color
 * so the student sees both errors AND omissions.
 *
 * Free mode intentionally shows no review block — the user picked
 * the passage themselves from a curated pool, so a diff isn't useful.
 */
function CompletionPanel({
  score,
  elapsedSec,
  reference,
  typed,
  mode,
  counted,
  peeked,
  errors,
  correctWords,
  totalWords,
  public: isPublic,
  showReview,
  onRetry,
  onNewFree,
}: {
  score: ReturnType<typeof computeScore>;
  elapsedSec: number;
  reference: string;
  typed: string;
  mode: Mode;
  /** True only when the run started in blind mode. */
  counted: boolean;
  /** True if the reference was previewed during this attempt. */
  peeked: boolean;
  /** Total wrong keystrokes this run — never reduced by backspace. */
  errors: number;
  /** Words typed correctly (position-wise match). */
  correctWords: number;
  /** Total words in the reference passage. */
  totalWords: number;
  /** Public (home page) rendering — minimal, no banners/badges. */
  public?: boolean;
  /** Whether to render the per-character review. */
  showReview: boolean;
  onRetry: () => void;
  onNewFree?: () => void;
}) {
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
    <div className="animate-fade-in-up space-y-4 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {verdict.title}
            </h2>
            {!isPublic && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
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
                  <Eye className="h-3 w-3" /> Practice — not scored
                </>
              )}
            </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{verdict.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          {onNewFree && (
            <Button variant="outline" onClick={onNewFree} className="gap-1.5">
              New passage
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {isPublic && (
        <p className="text-[11px] text-muted-foreground">
          Press{' '}
          <kbd className="rounded border border-border bg-background px-1 font-mono">
            Tab
          </kbd>{' '}
          to restart the same passage — or pick “New passage” for different
          text.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 sm:grid-cols-6">
        <ResultStat label="wpm" value={score.wpm} accent={counted} />
        <ResultStat label="raw wpm" value={score.rawWpm} />
        <ResultStat label="accuracy" value={`${score.accuracy}%`} accent={counted} />
        <ResultStat
          label="correct words"
          value={`${correctWords}/${totalWords}`}
        />
        <ResultStat label="errors" value={errors} />
        <ResultStat
          label="time"
          value={`${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`}
        />
      </div>

      {isPublic ? (
        <p className="text-[11px] text-muted-foreground">
          Results are session-only — cleared when you refresh.
        </p>
      ) : (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4">
        <p className="text-xs text-amber-800 font-medium">
          🚧 Under progress — results are NOT stored.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          This score is shown for the current test only. Refreshing the page
          clears it. Results will be saved once the database backend is
          connected.
        </p>
      </div>
      )}

      {!counted && !isPublic && (
        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {peeked
            ? 'You previewed the reference during this attempt, so these numbers are for practice only and are not scored. Restart to record a clean blind run.'
            : 'The passage was visible at the start of this run, so these numbers are for practice only and are not scored. Turn on blind mode to record a result.'}
        </p>
      )}

      {/* Inline review — the full diff, plus a per-character table */}
      {showReview && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Your typing</span>
              <span className="ml-auto inline-flex items-center gap-3">
                <LegendSwatch
                  className="bg-background/30"
                  label="correct"
                  borderClass="border-border"
                />
                <LegendSwatch
                  className="bg-destructive/30"
                  label="wrong"
                  borderClass="border-destructive/40"
                />
                <LegendSwatch
                  className="bg-warning/20"
                  label="missed"
                  borderClass="border-warning/40"
                />
              </span>
            </div>
            <ReviewBlock reference={reference} typed={typed} />
          </div>

          <DiffTable reference={reference} typed={typed} />
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
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          'h-2 w-2 rounded-sm border',
          borderClass ?? 'border-border',
          className
        )}
      />
      {label}
    </span>
  );
}

/**
 * Single-pass review for dictation / custom modes.
 *
 * Iterates over `reference` (which is the source of truth for
 * length and ordering) and renders each character:
 *   - matched & typed   → muted green tint (correct)
 *   - mismatched & typed → red tint (wrong)
 *   - never typed        → amber/warning tint (missed)
 *
 * Anything the student typed PAST the end of the reference is
 * appended in red at the very end so they can see overflow.
 */
function ReviewBlock({
  reference,
  typed,
}: {
  reference: string;
  typed: string;
}) {
  const chars: { ch: string; state: 'correct' | 'wrong' | 'missed' | 'overflow' }[] = [];

  for (let i = 0; i < reference.length; i++) {
    const t = typed[i];
    if (t === undefined) {
      chars.push({ ch: reference[i], state: 'missed' });
    } else if (t === reference[i]) {
      chars.push({ ch: t, state: 'correct' });
    } else {
      chars.push({ ch: t, state: 'wrong' });
    }
  }
  if (typed.length > reference.length) {
    for (let i = reference.length; i < typed.length; i++) {
      chars.push({ ch: typed[i], state: 'overflow' });
    }
  }

  if (chars.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Nothing to review.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background p-4 font-mono text-base leading-relaxed whitespace-pre-wrap break-words sm:text-lg">
      {chars.map((c, i) => {
        const display = c.ch === ' ' ? '\u00A0' : c.ch;
        return (
          <span
            key={i}
            className={cn(
              c.state === 'correct' && 'text-foreground',
              c.state === 'wrong' &&
                'text-destructive underline decoration-destructive decoration-2 underline-offset-3',
              c.state === 'missed' &&
                'text-warning underline decoration-warning decoration-dotted decoration-2 underline-offset-3',
              c.state === 'overflow' &&
                'rounded-sm bg-destructive/20 text-destructive line-through'
            )}
          >
            {display}
          </span>
        );
      })}
    </div>
  );
}
/* ─── Difference table ───────────────────────────────────── */

type DiffKind = 'wrong' | 'missed' | 'extra';

type DiffEntry = {
  /** 0-based word index in the passage. */
  index: number;
  /** What word the passage had there (null when the student added extra text). */
  expected: string | null;
  /** What word the student typed (null when the word was skipped). */
  actual: string | null;
  kind: DiffKind;
};

/**
 * Build a readable list of every *word* where the student's typing
 * differs from the passage. Consecutive missed words are merged into
 * a single entry so a long un-typed tail reads as one entry.
 */
function buildDiff(reference: string, typed: string): DiffEntry[] {
  const passageWords = reference.trim().split(/\s+/).filter((w) => w.length > 0);
  const typedWords = typed.trim().split(/\s+/).filter((w) => w.length > 0);
  const entries: DiffEntry[] = [];
  const total = Math.max(passageWords.length, typedWords.length);

  for (let i = 0; i < total; i++) {
    const expected = passageWords[i];
    const actual = typedWords[i];

    if (expected === undefined && actual !== undefined) {
      const prev = entries[entries.length - 1];
      if (prev && prev.kind === 'extra' && prev.index + 1 === i) {
        prev.actual = (prev.actual ?? '') + ' ' + actual;
        continue;
      }
      entries.push({ index: i, expected: null, actual, kind: 'extra' });
      continue;
    }
    if (expected !== undefined && actual === undefined) {
      const prev = entries[entries.length - 1];
      if (prev && prev.kind === 'missed' && prev.index + 1 === i) {
        prev.expected = (prev.expected ?? '') + ' ' + expected;
        continue;
      }
      entries.push({ index: i, expected, actual: null, kind: 'missed' });
      continue;
    }
    if (expected !== actual && actual !== undefined) {
      entries.push({ index: i, expected, actual, kind: 'wrong' });
    }
  }

  return entries;
}

/**
 * One cell of the difference table — shows whole words.
 *
 * Words are shown as readable text with a short truncation for long
 * entries so a long missed tail reads as one readable line instead
 * of a wall of single-character blocks.
 */
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
        'block font-mono text-[13px] leading-relaxed break-words',
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

function DiffTable({
  reference,
  typed,
}: {
  reference: string;
  typed: string;
}) {
  const diffs = useMemo(() => buildDiff(reference, typed), [reference, typed]);
  // Missed words are surfaced in the amber review block above; the
  // table lists only wrong/extra words, so the header counts rows
  // that actually appear.
  const tableRows = useMemo(
    () => diffs.filter((d) => d.kind !== 'missed'),
    [diffs]
  );
  const LIMIT = 80;
  const shown = tableRows.slice(0, LIMIT);
  const hidden = tableRows.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>What word was there vs what you typed</span>
        <span className="ml-auto font-mono tabular-nums">
          {tableRows.length} word difference{tableRows.length === 1 ? '' : 's'}
        </span>
      </div>

      {diffs.length === 0 ? (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-4 text-sm text-foreground">
          No differences — every word matched the passage.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">
                    Passage
                  </th>
                  <th className="px-2 py-2 text-left font-medium">
                    You typed
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.filter((d) => d.kind !== 'missed').map((d) => (
                  <tr
                    key={`${d.index}-${d.kind}`}
                    className="border-b border-border/60 align-top last:border-0"
                  >
                    <td className="px-2 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {d.index + 1}
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={d.expected}
                        emptyLabel="—"
                        tone={d.kind === 'missed' ? 'missed' : 'plain'}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <DiffSnippet
                        value={d.actual}
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
              Showing the first {LIMIT} of {tableRows.length} word differences.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Recent runs (public home page) ─────────────────────── */

/**
 * Session-only history of runs from this visit (max 5), for the
 * public home page. Runs recorded on /typing and the student area
 * share the same in-memory store, so this popover shows them all
 * until the page is refreshed.
 */
function RecentRuns() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);

  useEffect(() => {
    setResults(getSessionResults());
    return subscribeSessionResults(() => setResults(getSessionResults()));
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
          open ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <History className="h-3.5 w-3.5" strokeWidth={1.5} />
        Recent runs
        <span className="font-mono tabular-nums">{results.length}</span>
      </button>

      {open && (
        <div className="mt-2 w-full max-w-md rounded-md border border-border bg-surface p-3 sm:ml-auto sm:w-80">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              This visit only
            </span>
            {results.length > 0 && (
              <button
                type="button"
                onClick={clearSessionResults}
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No runs yet — finish a test and it appears here (cleared on
              refresh).
            </p>
          ) : (
            <ul className="space-y-1.5">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 font-mono text-xs tabular-nums"
                >
                  <span className="font-semibold text-foreground">
                    {r.wpm} wpm
                  </span>
                  <span className="text-muted-foreground">{r.accuracy}%</span>
                  <span className="text-muted-foreground">
                    {r.correctWords}/{r.totalWords} words
                  </span>
                  <span className="text-muted-foreground">{r.duration}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">
                    {r.practice}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
