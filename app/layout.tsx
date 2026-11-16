import './globals.css';
import type { Metadata } from 'next';
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

