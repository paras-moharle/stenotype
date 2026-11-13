import Link from 'next/link';
import {
  Headphones,
  Scale,
  Keyboard,
  ArrowRight,
  Clock,
  RotateCcw,
  CheckCircle2,
  Gavel,
  FileText,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <>
      {/* ────────────────────────────── HERO ────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container-page relative">
          <div className="grid items-center gap-16 py-24 lg:grid-cols-5 lg:py-32">
            <div className="animate-fade-in-up lg:col-span-3">
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground text-balance sm:text-5xl lg:text-6xl">
                Dictation.{' '}
                <span className="text-brand">Transcription.</span> Typing.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground text-balance">
                A focused digital practice companion for stenography students.
                Build speed, improve accuracy, and track your progress between
                classes.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="group">
                  <Link href="/typing">
                    Start Practicing
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Link
                  href="/classes"
                  className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Learn about classes →
                </Link>
              </div>
            </div>
            <div className="animate-fade-in-up [animation-delay:100ms] lg:col-span-2">
              <HeroPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── DICTATION PRACTICE ───────────────────────── */}
      <section className="border-b border-border py-20 lg:py-28">
        <div className="container-page grid items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-brand">
              Dictation practice
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Listen. Write shorthand. Transcribe.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-balance">
              Practice with provided dictation passages, then transcribe your
              shorthand notes into accurate English. The same categories used
              in professional stenography training.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              {[
                { icon: Scale, label: 'Legal' },
                { icon: Gavel, label: 'Court' },
                { icon: FileText, label: 'General' },
                { icon: Briefcase, label: 'Professional' },
              ].map((cat) => (
                <div key={cat.label} className="flex items-center gap-2">
                  <cat.icon className="h-4 w-4 text-brand" strokeWidth={1.5} />
                  <span className="text-sm text-foreground">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DictationPreview />
        </div>
      </section>

      {/* ───────────────────────── TYPING PRACTICE ───────────────────────── */}
      <section className="border-b border-border py-20 lg:py-28">
        <div className="container-page grid items-center gap-16 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <TypingPreview />
          </div>
          <div className="order-1 lg:order-2">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-brand">
              Typing practice
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Build speed and accuracy.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-balance">
              Focused typing sessions with real-time feedback on speed,
              accuracy, and errors. The passage stays visible so you can
              practice transcription the way it happens in class.
            </p>
            <Button asChild size="lg" className="mt-8 group">
              <Link href="/typing">
                Try Typing Practice
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ──────────────────────────── FINAL CTA ──────────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="container-page">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
              Ready to practice?
            </h2>
            <p className="mt-4 text-base text-muted-foreground text-balance">
              Build speed and accuracy one session at a time.
            </p>
            <Button asChild size="lg" className="mt-8 group">
              <Link href="/typing">
                Start Practicing
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/* ──────────────────────────── HERO PREVIEW ──────────────────────────── */
function HeroPreview() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          stenotype.app/typing
        </span>
      </div>
      <div className="p-6">
        <div className="mb-6 flex items-center gap-6">
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              62
            </p>
            <p className="text-xs text-muted-foreground">WPM</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              98<span className="text-base text-muted-foreground">%</span>
            </p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              0:28
            </p>
            <p className="text-xs text-muted-foreground">Time</p>
          </div>
        </div>
        <p className="font-mono text-sm leading-loose">
          <span className="text-muted-foreground/60">The court shall proceed </span>
          <span className="text-foreground">with the examination </span>
          <span className="border-b-2 border-brand pb-0.5 text-foreground">of</span>
          <span className="text-muted-foreground/60"> the witness in accordance</span>
          <span className="text-destructive"> with</span>
          <span className="text-muted-foreground/60"> the provisions of law.</span>
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────── DICTATION PREVIEW ──────────────────────── */
function DictationPreview() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Headphones className="h-4 w-4 text-brand" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground">
            Legal Dictation
          </span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">120 WPM</span>
      </div>
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground transition-transform hover:scale-105"
          aria-label="Play"
        >
          <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-brand-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-0.5">
            {[0.3, 0.5, 0.7, 0.4, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.4, 0.6, 0.8, 0.3, 0.5, 0.7, 0.4, 0.6, 0.5, 0.3, 0.7].map(
              (h, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full bg-brand/50"
                  style={{ height: `${h * 20 + 4}px` }}
                />
              )
            )}
          </div>
        </div>
        <span className="font-mono text-xs text-muted-foreground">0:42</span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The honorable court may, at its discretion, permit the introduction of
        additional evidence provided that such evidence is relevant to the
        matters at hand.
      </p>
    </div>
  );
}

/* ──────────────────────── TYPING PREVIEW ──────────────────────── */
function TypingPreview() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-brand" strokeWidth={1.5} />
          <span className="text-sm font-medium text-foreground">
            Typing Test
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> 0:30
          </span>
          <span className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </span>
        </div>
      </div>
      <p className="font-mono text-base leading-loose">
        <span className="text-muted-foreground/60">The proceedings of the </span>
        <span className="text-foreground">court were conducted </span>
        <span className="border-b-2 border-brand pb-0.5 text-foreground">in</span>
        <span className="text-muted-foreground/60"> accordance with the established</span>
        <span className="text-destructive"> legal</span>
        <span className="text-muted-foreground/60"> procedures and all parties were given</span>
      </p>
      <div className="mt-5 flex items-center gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="font-mono">96% accuracy</span>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          58 WPM · 3 errors
        </div>
      </div>
    </div>
  );
}
