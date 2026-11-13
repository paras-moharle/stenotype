import Link from 'next/link';
import {
  Headphones,
  PenLine,
  Scale,
  FileText,
  Briefcase,
  ArrowRight,
  Repeat,
} from 'lucide-react';
import { PageHeader } from '@/components/site/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const classCategories = [
  {
    icon: Headphones,
    title: 'Dictation',
    description:
      'Listen to dictated passages and practice writing them in shorthand.',
  },
  {
    icon: PenLine,
    title: 'Transcription',
    description:
      'Transcribe your shorthand notes back into accurate English.',
  },
  {
    icon: Scale,
    title: 'Legal Dictation',
    description:
      'Practice with legal terminology, courtroom language, and formal proceedings.',
  },
  {
    icon: FileText,
    title: 'General Dictation',
    description:
      'Practice clear everyday English across a range of subjects and situations.',
  },
  {
    icon: Briefcase,
    title: 'Professional Dictation',
    description:
      'Practice office and business language, including correspondence, reports, and meeting minutes.',
  },
];

const practiceFlow = [
  {
    step: '01',
    title: 'Attend classes',
    description: 'Learn shorthand and dictation through your regular classes.',
  },
  {
    step: '02',
    title: 'Practice on StenoType',
    description: 'Reinforce classwork with daily dictation, transcription, and typing.',
  },
  {
    step: '03',
    title: 'Track progress',
    description: 'Monitor speed, accuracy, and practice results over time.',
  },
  {
    step: '04',
    title: 'Repeat',
    description: 'Consistent practice between classes builds speed and accuracy.',
  },
];

export default function ClassesPage() {
  return (
    <div className="container-page py-12 lg:py-16">
      <PageHeader
        eyebrow="Classes"
        title="Stenography classes and dictation practice"
        description="Attend your regular stenography classes, then use StenoType to practice dictation, transcription, and typing between sessions."
      />

      {/* Category cards */}
      <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
        {classCategories.map((cat) => (
          <div key={cat.title} className="bg-card p-6 lg:p-5">
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

      {/* Practice flow */}
      <section className="mt-16">
        <div className="mb-8 max-w-xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
            How it works
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Physical classes and StenoType, together
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {practiceFlow.map((item, i) => (
            <div key={item.step} className="bg-card p-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-muted-foreground">
                  {item.step}
                </span>
                {i === 3 && (
                  <Repeat className="h-4 w-4 text-brand" strokeWidth={1.5} />
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Relationship */}
      <section className="mt-16">
        <Card className="border-border bg-card p-8 shadow-none lg:p-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Classes and StenoType
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Physical classes teach the foundations. StenoType gives you a
                place to practice dictation, transcription and typing between
                sessions.
              </p>
            </div>
            <div className="space-y-3">
              {[
                'Consistent daily practice between class sessions',
                'The same dictation categories covered in class',
                'Track WPM, accuracy, and errors to find what needs work',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-4"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-lg border border-border bg-muted/30 p-10 text-center lg:p-14">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Ready to start practicing?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Try the typing experience and see how StenoType fits into your routine.
        </p>
        <Button asChild size="lg" className="mt-6 group">
          <Link href="/typing">
            Start Practicing
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
