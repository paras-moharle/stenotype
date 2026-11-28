import Link from 'next/link';
import { ArrowUpRight, FileCheck2, Headphones, Keyboard, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  [Headphones, 'Listen', 'Open the recording on YouTube and take it down in shorthand.'],
  [PenLine, 'Transcribe', 'Type out your notes with the reference transcript hidden.'],
  [FileCheck2, 'Review', 'Compare your text against the official passage and see your score.'],
] as const;

export default function AboutPage() {
  return (
    <article className="container-page py-6 sm:py-16">
      <header className="practice-intro">
        <div>
          <p className="mb-3 text-sm font-medium text-brand">About StenoType</p>
          <h1 className="editorial-title max-sm:text-[clamp(2.55rem,12vw,4.2rem)]">A practice space for <em className="sm:not-italic">stenography.</em></h1>
        </div>
        <p className="practice-note">Build typing fluency, take down dictation, and review the transcription one passage at a time.</p>
      </header>
      <div className="grid gap-3 border-b border-border py-5 sm:py-8 md:grid-cols-2">
        <section className="panel p-5 sm:p-6">
          <Keyboard className="mb-3 size-5 text-brand" aria-hidden />
          <h2 className="text-h2 font-semibold">Timed typing</h2>
          <p className="my-3 max-w-prose text-muted-foreground">Choose a topic and set a 15, 30, or 60 second timer. Timing starts with your first keystroke. You can practise without an account.</p>
          <Button asChild><Link href="/">Start free practice <ArrowUpRight className="size-4" aria-hidden /></Link></Button>
        </section>
        <section className="panel p-5 sm:p-6">
          <Headphones className="mb-3 size-5 text-brand" aria-hidden />
          <h2 className="text-h2 font-semibold">Student dictations</h2>
          <p className="my-3 max-w-prose text-muted-foreground">Student accounts give you access to published dictations, your results history, and the option to practise with your own text.</p>
          <Button asChild variant="outline"><Link href="/login">Student sign in</Link></Button>
        </section>
      </div>
      <section className="grid gap-6 border-b border-border py-8 md:grid-cols-[1fr_2fr]">
        <h2 className="text-h2 font-semibold">How dictation practice works</h2>
        <ol className="divide-y divide-border border-y border-border">
          {steps.map(([Icon, title, description]) => (
            <li key={title} className="grid grid-cols-[2rem_1fr] gap-x-2 gap-y-1 py-3 sm:grid-cols-[2rem_7rem_1fr]">
              <Icon className="mt-0.5 size-4 text-brand" aria-hidden />
              <strong className="font-medium">{title}</strong>
              <span className="col-start-2 text-muted-foreground sm:col-start-auto">{description}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-4 pt-8 md:grid-cols-[1fr_2fr]">
        <h2 className="text-h2 font-semibold">Access and support</h2>
        <div className="space-y-3 text-muted-foreground">
          <p>Ask your administrator to create a student account or help with sign in.</p>
          <div className="flex flex-wrap gap-4">
            <a className="text-brand underline underline-offset-4" href="tel:+919673002886">+91 96730 02886</a>
            <a className="text-brand underline underline-offset-4" href="tel:+917666286532">+91 76662 86532</a>
            <a className="text-brand underline underline-offset-4" href="https://github.com/paras-moharle/stenotype">Project on GitHub</a>
          </div>
        </div>
      </section>
    </article>
  );
}
