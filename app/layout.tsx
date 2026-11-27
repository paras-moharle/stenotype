import './globals.css';
import type { Metadata, Viewport } from 'next';
// Static and deterministic. Runs before paint without personalizing the HTML.
const themeBootstrap = `try { const theme = localStorage.getItem("stenotype-theme"); if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme; } catch {}`;

export const metadata: Metadata = {
  title: 'StenoType — Dictation. Transcription. Precision.',
  description:
    'A focused typing and dictation-practice platform for stenography students. Practice transcription, improve accuracy, and build speed.',
  openGraph: {
    title: 'StenoType — Dictation. Transcription. Precision.',
    description:
      'A focused typing and dictation-practice platform for stenography students.',
    type: 'website',
  },
};

/**
 * Next injects this itself — declaring it here (instead of a raw
 * <meta> tag) avoids a duplicate tag and lets us add `viewportFit`,
 * which is required for `env(safe-area-inset-bottom)` to be non-zero
 * on iPhones with a home indicator.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className="font-sans antialiased">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}

