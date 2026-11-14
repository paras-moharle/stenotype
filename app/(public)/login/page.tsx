'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/use-auth';

export default function LoginPage() {
  const { user, isAuthenticated, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, go to the correct dashboard — never back home.
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      window.location.assign(
        user.role === 'admin' ? '/admin' : '/student/dashboard'
      );
    }
  }, [isLoading, isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // signIn performs a hard redirect to the dashboard on success.
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page flex min-h-[calc(100vh-10rem)] items-center justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="mb-5 flex items-center gap-2">
            <LogIn className="h-4 w-4 text-brand" strokeWidth={1.5} />
            <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border border-border bg-background pl-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || !email || !password}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Just want to try typing?{' '}
          <Link
            href="/"
            className="font-medium text-brand transition-colors hover:text-brand/80"
          >
            Start practising without signing in
          </Link>
        </p>
      </div>
    </div>
  );
}
