import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  EyeOff,
  FileText,
  Keyboard,
  Scale,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/site/page-header';
import { cn } from '@/lib/utils';

const practiceSteps = [
  {
    icon: Keyboard,
    title: 'Choose what to practise',
    description:
      'Pick a free passage by topic, or switch to dictation and custom-text practice.',
  },
  {
    icon: EyeOff,
    title: 'Type with focus',
    description:
      'Keep the reference visible for a warm-up, or hide it for blind practice.',
  },
  {
    icon: CheckCircle2,
    title: 'Review your run',
    description:
      'Check your speed and accuracy, then review the comparison after dictation or custom practice.',
  },
];

const categories = [
  {
    icon: Scale,
    title: 'Legal',
    detail: 'Formal language and proceedings',
    description:
      'Courtroom language covering hearings, affidavits, submissions, and formal proceedings.',
  },
  {
    icon: Briefcase,
    title: 'Professional',
    detail: 'Workplace and business English',
    description:
      'Reports, correspondence, agendas, and minutes for office and business practice.',
  },
  {
    icon: FileText,
    title: 'General',
    detail: 'Everyday subjects and situations',
    description:
      'Clear everyday English across a range of everyday subjects and situations.',
  },
];

const durations = ['15s', '30s', '60s'];

export default function ClassesPage() {
  return (
    <div className="container-page py-8 sm:py-12 lg:py-16">
      <section className="relative isolate overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-brand/[0.06] via-surface/85 to-background/75 p-5 shadow-sm sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/[0.07] blur-3xl"
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:gap-10">
          <div>
            <PageHeader
              eyebrow="Classes & practice"
              title="Practice between classes."
              description="StenoType complements your regular stenography classes. Use it for free passage warm-ups, dictation practice, and a closer look at your typing after a run."
            />

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start free practice
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/about"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-brand/30 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              >
                About StenoType
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-background/75 p-4 shadow-sm backdrop-blur-sm sm:p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-12 h-40 w-40 rounded-full bg-brand/[0.06] blur-3xl"
            />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">
                    A quick warm-up
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    Make a little time count.
                  </h2>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
                  <Sparkles className="h-4 w-4" strokeWidth={1.6} />
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-surface/60 p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Choose a duration
                </p>
                <div className="mt-2 flex gap-2">
                  {durations.map((duration) => (
                    <span
                      key={duration}
                      className={cn(
                        'inline-flex min-h-8 min-w-12 items-center justify-center rounded-lg border px-2 font-mono text-xs tabular-nums',
                        duration === '30s'
                          ? 'border-brand/30 bg-brand text-brand-foreground'
                          : 'border-border bg-background/70 text-muted-foreground'
                      )}
                    >
                      {duration}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                  Pick a topic, set your pace, and begin from the home page.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {['Legal', 'Professional', 'General'].map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 sm:mt-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              How practice works
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Three steps. One focused session.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Keep the setup simple so you can focus on the passage and the
            progress you make.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {practiceSteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-border/80 bg-surface/65 p-4 transition-colors hover:border-brand/25 hover:bg-surface/85 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-brand/[0.07] text-brand">
                  <step.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 sm:mt-14">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            Passage topics
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Practise across three categories.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose a subject that fits the kind of language you want to work
            with.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {categories.map((category, index) => (
            <article
              key={category.title}
              className="rounded-2xl border border-border/80 bg-surface/65 p-4 transition-colors hover:border-brand/25 hover:bg-surface/85 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/15 bg-brand/[0.07] text-brand">
                  <category.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-4 text-base font-semibold text-foreground">
                {category.title}
              </h3>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-brand/80">
                {category.detail}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {category.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative isolate mt-10 overflow-hidden rounded-3xl border border-brand/20 bg-surface/80 p-5 shadow-sm sm:mt-14 sm:p-8 lg:p-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/[0.07] blur-3xl"
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
              Free practice
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Start with a passage. No login needed.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose a category and duration on the home page, then begin
              typing. It’s an easy way to warm up or keep a regular practice
              rhythm between dictations.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-center"
          >
            Open free practice
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
