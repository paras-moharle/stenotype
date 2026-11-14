import Link from 'next/link';
import { ArrowRight, Keyboard, EyeOff, Scale, FileText, Briefcase } from 'lucide-react';
import { PageHeader } from '@/components/site/page-header';

const categories = [
  {
    icon: Scale,
    title: 'Legal',
    description:
      'Courtroom language — hearings, affidavits, submissions, and formal proceedings.',
  },
  {
    icon: Briefcase,
    title: 'Professional',
    description:
      'Office and business English — reports, correspondence, agendas, and minutes.',
  },
  {
    icon: FileText,
    title: 'General',
    description:
      'Clear everyday English across a range of everyday subjects and situations.',
  },
];

export default function ClassesPage() {
  return (
    <div className="container-page py-12 lg:py-16">
      <PageHeader
        eyebrow="Classes"
        title="Practice between classes"
        description="StenoType is the companion to your regular stenography classes. Your teacher assigns the dictations; you come here to type."
      />

      {/* How practice works — the three real steps */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Keyboard,
            title: 'Open a dictation',
            description:
              'Each assigned dictation is a passage. You type it in blind mode — the text is hidden until you finish.',
          },
          {
            icon: EyeOff,
            title: 'Type it blind',
            description:
              'No peeking: you work from memory or your shorthand notes, exactly like a real dictation exam.',
          },
          {
            icon: ArrowRight,
            title: 'Compare word by word',
            description:
              'After submitting you get WPM, accuracy, errors, and a word-by-word diff against the reference.',
          },
        ].map((step, i) => (
          <div key={step.title} className="rounded-lg border border-border bg-card p-6">
            <span className="font-mono text-xs text-muted-foreground">
              0{i + 1}
            </span>
            <step.icon
              className="mt-3 h-5 w-5 text-brand"
              strokeWidth={1.5}
            />
            <h3 className="mt-3 text-base font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      {/* Dictation categories — the same ones used everywhere in the app */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Dictation categories
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Every passage — in class dictations and free practice alike — belongs
          to one of three categories, matching what stenography courses cover.
        </p>
        <div className="mt-6 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.title} className="bg-card p-6">
              <cat.icon className="mb-4 h-5 w-5 text-brand" strokeWidth={1.5} />
              <h3 className="text-base font-semibold text-foreground">
                {cat.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Free practice — always available, no login needed */}
      <section className="mt-14 rounded-lg border border-border bg-muted/30 p-8 lg:p-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Free practice, no login needed
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The home page is a full typing test — pick a category and a duration
          and start typing immediately. Passages are 50–100 words of coherent
          English. Use it to warm up before class or to build raw speed between
          dictations.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
        >
          Open the typing test
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
