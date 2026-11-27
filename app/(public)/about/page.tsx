import Link from 'next/link';
import { Headphones, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  ['Listen', 'Open a published dictation and take it down in shorthand.'],
  ['Transcribe', 'Type out your notes with the reference transcript hidden.'],
  ['Review', 'Compare your text against the official passage and see your score.'],
];

export default function AboutPage() {
  return (
    <article className="container-page py-10 sm:py-16">
      <header className="practice-intro">
        <div>
          <p className="mb-3 text-sm font-medium text-brand">About StenoType</p>
          <h1 className="editorial-title">A practice space for stenography.</h1>
        </div>
        <p className="practice-note">Build typing fluency, take down dictation, and review the transcription one passage at a time.</p>
      </header>
      <div className="grid gap-8 border-b border-border py-8 md:grid-cols-2 md:divide-x md:divide-border">
        <section>
          <Keyboard className="mb-3 size-5 text-brand" aria-hidden />
          <h2 className="text-h2 font-semibold">Timed typing</h2>
          <p className="my-3 max-w-prose text-muted-foreground">Choose a topic and set a 15, 30, or 60 second timer. Timing starts with your first keystroke. You can practise without an account.</p>
          <Button asChild><Link href="/">Start free practice</Link></Button>
        </section>
        <section className="md:pl-8">
          <Headphones className="mb-3 size-5 text-brand" aria-hidden />
          <h2 className="text-h2 font-semibold">Student dictations</h2>
          <p className="my-3 max-w-prose text-muted-foreground">Student accounts give you access to published dictations, your results history, and the option to practise with your own text.</p>
          <Button asChild variant="outline"><Link href="/login">Student sign in</Link></Button>
        </section>
      </div>
      <section className="grid gap-6 border-b border-border py-8 md:grid-cols-[1fr_2fr]">
        <h2 className="text-h2 font-semibold">How dictation practice works</h2>
        <ol className="divide-y divide-border border-y border-border">
          {steps.map(([title, description]) => (
            <li key={title} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr]">
              <strong className="font-medium">{title}</strong>
              <span className="text-muted-foreground">{description}</span>
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
