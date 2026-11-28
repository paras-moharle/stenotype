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
    <div className="container-typing py-3 sm:py-10">
      <div className="practice-intro mb-2 max-sm:gap-1.5 max-sm:pb-3 sm:mb-5">
        <div>
          <p className="mb-1.5 text-xs sm:mb-3 sm:text-sm font-medium text-brand">Typing &amp; stenography practice</p>
          <h1 className="editorial-title max-sm:text-[clamp(1.9rem,7.9vw,2.75rem)] max-sm:leading-[1.03]">Build speed with <em className="sm:not-italic">precision.</em></h1>
        </div>
        <p className="practice-note max-sm:text-sm max-sm:leading-snug">Practice with curated passages, custom text or dictations.</p>
      </div>
      <TypingClient variant="public" initialPassage={initialPassage} />
    </div>
  );
}
