import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  EyeOff,
  Github,
  Headphones,
  Keyboard,
  Phone,
  Sparkles,
  Target,
} from 'lucide-react';

const practiceSteps = [
  {
    icon: Keyboard,
    title: 'Choose a passage',
    detail: 'Pick a topic, dictation, or your own text.',
  },
  {
    icon: EyeOff,
    title: 'Focus on the typing',
    detail: 'Practice with the reference visible or hidden.',
  },
  {
    icon: CheckCircle2,
    title: 'Review the result',
    detail: 'See your speed, accuracy, and detailed comparison.',
  },
];

const features = [
  {
    icon: Sparkles,
    title: 'Get straight to practice',
    description:
      'Open the public typing test, choose a topic and duration, and begin without creating an account.',
  },
  {
    icon: Target,
    title: 'Feedback that means something',
    description:
      'Words are compared exactly. Letter case and punctuation are part of the result, not ignored.',
  },
  {
    icon: Headphones,
    title: 'Different ways to practise',
    description:
      'Switch between free passages, dictation, and custom text to suit the session.',
  },
];

export default function AboutPage() {
  return (
    <div className="container-page py-8 sm:py-12 lg:py-16">
      <section className="relative isolate overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-brand/[0.06] via-surface/85 to-background/75 p-5 shadow-sm sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/[0.07] blur-3xl"
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(290px,0.9fr)] lg:gap-10">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              About StenoType
            </p>

            <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              A focused space to build your typing{' '}
              <span className="text-brand">flow.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              StenoType is a typing-practice platform for stenography students.
              Choose a passage, set a duration, and spend your time on the
              practice—not on setup.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start practicing
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-brand/30 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              >
                Get in touch
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">
                  The practice loop
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Simple by design
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
                <Keyboard className="h-4 w-4" strokeWidth={1.6} />
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {practiceSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/60 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-3xl bg-brand/[0.08] text-brand">
                    <step.icon className="h-4 w-4" strokeWidth={1.6} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>

                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    0{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 sm:mt-14">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            What it focuses on
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Useful practice, without the noise.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A small set of tools to help you spend more time typing and
            understand your results.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border/80 bg-surface/65 p-4 transition-colors hover:border-brand/25 hover:bg-surface/85 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-brand/[0.07] text-brand">
                  <feature.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            The person behind it
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Built by Paras Moharle.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            StenoType is built around a simple idea: regular, focused practice
            should be easy to start and useful to review.
          </p>

          <a
            href="https://github.com/paras-moharle"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-medium text-foreground transition hover:border-brand/30 hover:bg-surface-hover"
          >
            <Github className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
            View GitHub profile
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>

        <div
          id="contact"
          className="rounded-2xl border border-border/80 bg-surface/70 p-5 sm:p-6"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            Get in touch
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Questions or feedback?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You can reach out by phone.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href="tel:+917666286532"
              className="group flex min-h-12 items-center gap-2.5 rounded-xl border border-border/80 bg-background/60 px-3 py-2 transition hover:border-brand/30 hover:bg-surface-hover"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-3xl bg-brand/[0.07] text-brand">
                <Phone className="h-3.5 w-3.5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 font-mono text-xs tabular-nums text-foreground group-hover:text-brand">
                +91 7666286532
              </span>
            </a>

            <a
              href="tel:+919673002886"
              className="group flex min-h-12 items-center gap-2.5 rounded-xl border border-border/80 bg-background/60 px-3 py-2 transition hover:border-brand/30 hover:bg-surface-hover"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-3xl bg-brand/[0.07] text-brand">
                <Phone className="h-3.5 w-3.5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 font-mono text-xs tabular-nums text-foreground group-hover:text-brand">
                +91 9673002886
              </span>
            </a>
          </div>
        </div>
      </section>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-5 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-muted-foreground">
          Ready for a focused practice session?
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand transition hover:text-foreground"
        >
          Open the typing test
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

