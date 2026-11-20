'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatISTDate } from '@/lib/datetime';
import Link from 'next/link';
import {
  Youtube,
  Eye,
  Keyboard,
  BarChart3,
  X,
} from 'lucide-react';
import {
  StudentHeader,
} from '@/components/student/student-header';
import { Button } from '@/components/ui/button';

type Dictation = {
  id: string;
  title: string;
  category: string;
  youtubeId: string | null;
  durationSeconds: number | null;
};

type Attempt = {
  id: string;
  wpm: number;
  accuracy: number;
  createdAt: string;
};

export default function StudentDictationsPage() {
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingText, setViewingText] = useState<Dictation | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [viewingResults, setViewingResults] = useState<Dictation | null>(null);
  const [results, setResults] = useState<Attempt[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const fetchDictations = useCallback(async () => {
    try {
      const res = await fetch('/api/dictations');
      if (res.ok) {
        const data = await res.json();
        setDictations(data.dictations);
      } else {
        setError('Failed to load dictations');
      }
    } catch {
      setError('Failed to load dictations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDictations();
  }, [fetchDictations]);

  const handleViewText = async (dictation: Dictation) => {
    setViewingText(dictation);
    setTranscriptLoading(true);
    try {
      const res = await fetch(`/api/dictations/${dictation.id}/transcript`);
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
      } else {
        setTranscript('Transcript not available.');
      }
    } catch {
      setTranscript('Failed to load transcript.');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handleViewResults = async (dictation: Dictation) => {
    setViewingResults(dictation);
    setResultsLoading(true);
    try {
      const res = await fetch(`/api/student/attempts?dictationId=${dictation.id}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.attempts);
      }
    } catch {
      // Ignore — results will be empty.
    } finally {
      setResultsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <StudentHeader
        title="My Dictations"
        description="Listen to the audio, then type it blind."
      />

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading dictations...
        </div>
      ) : dictations.length === 0 ? (
        <div className="rounded-2xl border border-border p-8 text-center text-muted-foreground">
          No dictations available yet. Check back soon!
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {dictations.map((dictation, index) => (
            <div
              key={dictation.id}
              style={{ animationDelay: `${index * 50}ms` }}
              className="rounded-[2rem] border border-border bg-card overflow-hidden hover-lift animate-slide-up shadow-lg"
            >
              {/* Thumbnail-style header — big area, number centered */}
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-brand/30 via-brand/15 to-transparent">
                <span className="text-6xl font-extrabold text-brand drop-shadow-lg">
                  {index + 1}
                </span>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-bold">{dictation.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {dictation.category}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {dictation.youtubeId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-full w-full"
                    >
                      <a
                        href={`https://youtube.com/watch?v=${dictation.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Youtube className="mr-1 h-4 w-4" />
                        YouTube
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="rounded-full w-full">
                      <Youtube className="mr-1 h-4 w-4" />
                      No Video
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewText(dictation)}
                    className="rounded-full w-full"
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    View Text
                  </Button>

                  <Button
                    size="sm"
                    asChild
                    className="rounded-full w-full"
                  >
                    <Link
                      href={`/student/typing?mode=dictation&dictationId=${dictation.id}`}
                    >
                      <Keyboard className="mr-1 h-4 w-4" />
                      Practice
                    </Link>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewResults(dictation)}
                    className="rounded-full w-full"
                  >
                    <BarChart3 className="mr-1 h-4 w-4" />
                    My Results
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Text Modal */}
      {viewingText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-3xl bg-background p-6 max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{viewingText.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewingText.category}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingText(null)}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {transcriptLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading transcript...
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button asChild className="flex-1 rounded-full">
                <Link
                  href={`/student/typing?mode=dictation&dictationId=${viewingText.id}`}
                >
                  <Keyboard className="mr-2 h-4 w-4" />
                  Start Practice
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setViewingText(null)} className="rounded-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* My Results Modal */}
      {viewingResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-3xl bg-background p-6 max-h-[80vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">My Results</h2>
                <p className="text-sm text-muted-foreground">
                  {viewingResults.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingResults(null)}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {resultsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading results...
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attempts yet. Click Practice to start!
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between rounded-2xl border border-border p-4"
                  >
                    <div>
                      <div className="text-xl font-bold">{attempt.wpm} WPM</div>
                      <div className="text-sm text-muted-foreground">
                        {attempt.accuracy}% accuracy
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatISTDate(attempt.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

