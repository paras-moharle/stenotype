'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Copy, Keyboard, Youtube } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { dictationMetadata, type DictationMetadata } from '@/lib/dictation-catalog';
import { youtubeWatchUrl } from '@/lib/youtube';

type StudyContent = { transcript: string; dictation: DictationMetadata };

export function DictationStudy({ item, practiceHref }: { item: DictationMetadata; practiceHref: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" className="h-11 gap-2 px-2 text-xs sm:px-4 sm:text-sm" onClick={() => setOpen(true)}>
      <BookOpen size={16} className="hidden sm:block" aria-hidden /> View dictation
    </Button>
    {open && <StudyDialog item={item} practiceHref={practiceHref} onClose={() => setOpen(false)} />}
  </>;
}

function StudyDialog({ item, practiceHref, onClose }: { item: DictationMetadata; practiceHref: string; onClose: () => void }) {
  const [content, setContent] = useState<StudyContent | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/dictations/${encodeURIComponent(item.id)}/study`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 404 ? 'This dictation is unavailable.' :
          response.status === 401 ? 'Your session expired. Sign in and try again.' : 'Could not open the transcript.');
        return response.json() as Promise<StudyContent>;
      })
      .then(data => { if (!controller.signal.aborted) setContent(data); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error && cause.name !== 'TypeError'
          ? cause.message : 'Could not open the transcript. Check your connection.');
      });
    return () => controller.abort();
  }, [item.id, retry]);

  // After opening, use the same published row for both text and metadata.
  // A previously loaded catalog may still show an old video association.
  const details = content?.dictation ?? { ...item, youtubeId: null };
  const video = youtubeWatchUrl(content?.dictation?.youtubeId);
  const words = content?.transcript.match(/\S+/g)?.length ?? 0;

  async function copyTranscript() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content.transcript);
      setCopyStatus('Transcript copied.');
    } catch {
      setCopyStatus('Could not copy. You can select and copy the text manually.');
    }
  }

  return <Modal labelledBy="study-title" onClose={onClose} className="max-w-3xl overflow-hidden">
    <div className="grid max-h-[88dvh] grid-rows-[auto_minmax(0,1fr)_auto]">
      <header className="border-b border-border px-4 py-4 sm:px-7">
        <h2 id="study-title" className="wrap-break-word font-editorial text-2xl leading-tight sm:text-3xl">{details.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{dictationMetadata(details)}{content && ` · ${words} ${words === 1 ? 'word' : 'words'}`}</p>
      </header>
      <div role="region" aria-label="Transcript" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7">
        {error ? <div role="alert" className="space-y-2"><p>{error}</p>
          <Button variant="outline" onClick={() => { setError(''); setRetry(value => value + 1); }}>Try again</Button>
        </div> : !content ? <p role="status">Opening transcript…</p> :
          <div className="rounded-2xl border border-border bg-background px-4 py-4 sm:px-7 sm:py-6">
            <p className="mx-auto max-w-[62ch] whitespace-pre-wrap wrap-break-word font-editorial text-lg leading-[1.8] sm:text-xl">{content.transcript}</p>
          </div>}
      </div>
      <footer className="border-t border-border px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" disabled={!content} className="gap-2" onClick={copyTranscript}><Copy size={16} aria-hidden /> Copy text</Button>
          {video && <Button asChild variant="outline" className="gap-2">
            <a href={video} target="_blank" rel="noopener noreferrer"><Youtube size={16} aria-hidden /> Open on YouTube <span className="sr-only">(new tab)</span></a>
          </Button>}
          {content && <Button asChild className="gap-2"><Link href={practiceHref} prefetch={false}><Keyboard size={16} aria-hidden /> Practice</Link></Button>}
        </div>
        <p role="status" className="empty:hidden mt-2 text-xs text-muted-foreground">{copyStatus}</p>
      </footer>
    </div>
  </Modal>;
}
