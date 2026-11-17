import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

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
  themeColor: '#121110',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <div className="flex min-h-screen flex-col">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}

