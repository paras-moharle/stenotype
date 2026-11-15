import { cookies } from 'next/headers';
import TypingClient from '@/components/typing/typing-client';
import { SESSION_COOKIE, verifySession } from '@/lib/auth-server';

/**
 * Home = the typing test. The passage is the focus, the timer starts
 * on the first keystroke, and sign-in lives in the top bar.
 *
 * Blind dictation and custom-paste are members-only: guests see the
 * tabs but are redirected to /login when they try to use them.
 * The session is checked server-side so there is no client flash.
 */
export default async function HomePage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const authenticated = Boolean(token && verifySession(token));

  return (
    <div className="container-page py-4 sm:py-6 lg:py-8">
      <TypingClient variant="public" authenticated={authenticated} />
    </div>
  );
}
