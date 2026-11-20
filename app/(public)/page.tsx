import TypingClient from '@/components/typing/typing-client';

/**
 * Home = the typing test. The passage is the focus, the timer starts
 * on the first keystroke, and sign-in lives in the top bar.
 *
 * This page is intentionally STATIC: it no longer reads the session on
 * the server. Auth state comes from the shared provider (one client
 * request), so the busiest page costs no database query and is served
 * straight from the prerender. Blind dictation and custom-paste are
 * members-only: guests get the tabs but are sent to /login.
 */
export default function HomePage() {
  return (
    <div className="container-page py-4 sm:py-6 lg:py-8">
      <TypingClient variant="public" />
    </div>
  );
}
