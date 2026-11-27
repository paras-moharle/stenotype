import TypingClient from '@/components/typing/typing-client';
import { generatePassage } from '@/lib/passage-generator';

/**
 * Home = the typing test. The passage is the focus, the timer starts
 * on the first keystroke, and sign-in lives in the top bar.
 *
 * The first passage is generated on the server and passed down, so the
 * text is in the prerendered HTML. It used to be generated in a mount
 * effect, which left the typing area empty at first paint and pushed the
 * footer down once it appeared (0.14 of a 0.215 CLS on mobile). The page
 * stays static/ISR — no session read, no database query — and a fresh
 * passage is generated each revalidation. "New passage" and category
 * changes still rotate client-side.
 *
 * Blind dictation and custom-paste are members-only: guests get the tabs
 * but are sent to /login.
 */
export const revalidate = 60;

export default async function HomePage() {
  const initialPassage = await generatePassage({
    category: 'mixed',
    seconds: 30,
  });

  return (
    <div className="container-typing py-4 sm:py-10">
      <div className="practice-intro mb-3 max-sm:gap-2 max-sm:pb-3 sm:mb-5">
        <div>
          <p className="mb-2 text-xs sm:mb-3 sm:text-sm font-medium text-brand">Typing &amp; stenography practice</p>
          <h1 className="editorial-title max-sm:text-[clamp(1.8rem,7vw,2.25rem)]">Build speed with precision.</h1>
        </div>
        <p className="practice-note max-sm:text-sm max-sm:leading-snug">Practice with curated passages, your own text or published dictations.</p>
      </div>
      <TypingClient variant="public" initialPassage={initialPassage} />
    </div>
  );
}
