import { redirect } from 'next/navigation';

/**
 * The typing test now lives on the home page. This route stays as a
 * redirect so old links and bookmarks keep working.
 */
export default function TypingPage() {
  redirect('/');
}
