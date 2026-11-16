'use client';

import { useState, useEffect } from 'react';
import { StudentHeader } from '@/components/student/student-header';
import { TrendingUp } from 'lucide-react';

type Attempt = {
  id: string;
  wpm: number;
  accuracy: number;
  correctCharacters: number;
  incorrectCharacters: number;
  completed: boolean;
  createdAt: string;
};

export default function StudentResultsPage() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/student/attempts')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load results');
        return res.json();
      })
      .then((data) => {
        setAttempts(data.attempts);
      })
      .catch(() => {
        setError('Failed to load results');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const stats = attempts.length > 0 ? {
    total: attempts.length,
    avgWpm: Math.round(
      attempts.reduce((sum, a) => sum + a.wpm, 0) / attempts.length
    ),
    avgAccuracy: Math.round(
      attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length
    ),
    bestWpm: Math.max(...attempts.map((a) => a.wpm)),
  } : null;

  return (
    <div className="space-y-8">
      <StudentHeader
        title="My results"
        description="Your typing practice history."
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading results...
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-muted-foreground">
          No results yet. Complete a dictation to see your scores here.
        </div>
      ) : (
        <>
          {/* Summary stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total attempts</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-2xl font-bold">{stats.avgWpm}</div>
                <div className="text-sm text-muted-foreground">Avg WPM</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-2xl font-bold">{stats.avgAccuracy}%</div>
                <div className="text-sm text-muted-foreground">Avg accuracy</div>
              </div>
              <div className="rounded-lg border border-border p-4">
                <div className="text-2xl font-bold">{stats.bestWpm}</div>
                <div className="text-sm text-muted-foreground">Best WPM</div>
              </div>
            </div>
          )}

          {/* Attempts table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">WPM</th>
                  <th className="px-4 py-3 text-left font-medium">Accuracy</th>
                  <th className="px-4 py-3 text-left font-medium">Correct</th>
                  <th className="px-4 py-3 text-left font-medium">Incorrect</th>
                  <th className="px-4 py-3 text-left font-medium">Completed</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      {new Date(attempt.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">{attempt.wpm}</td>
                    <td className="px-4 py-3">{attempt.accuracy}%</td>
                    <td className="px-4 py-3 text-green-500">
                      {attempt.correctCharacters}
                    </td>
                    <td className="px-4 py-3 text-red-500">
                      {attempt.incorrectCharacters}
                    </td>
                    <td className="px-4 py-3">
                      {attempt.completed ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

