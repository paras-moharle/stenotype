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
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, go to the correct dashboard — never back home.
  //
  // Exception: the student/admin layouts redirect here with ?denied=1
  // when the session is valid but the account is banned or has the
  // wrong role. Auto-redirecting in that case would bounce forever
  // between /login and the dashboard, so we stop and explain instead.
  useEffect(() => {
    if (isLoading) return;

    const params = new URLSearchParams(window.location.search);
    const denied = params.get('denied') === '1';
    const signOutFailed = params.get('signout') === 'failed';

    if (signOutFailed) {
      // The session cookie is still alive, so auto-redirecting would
      // silently sign the user back in. Explain instead.
      setNotice(
        "We couldn't sign you out — your session is still active. Please try again."
      );
      return;
    }

    if (denied && isAuthenticated) {
      setNotice(
        'You are signed in, but this account does not have access to that area.'
      );
      return;
    }

    if (isAuthenticated && user) {
      window.location.replace(
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

        <div className="rounded-[2rem] border border-border bg-surface p-8 shadow-2xl animate-scale-in">
          <div className="mb-8 flex items-center gap-3">
            <LogIn className="h-6 w-6 text-brand" strokeWidth={1.8} />
            <h1 className="text-2xl font-bold text-foreground">Sign in</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
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
                  className="h-12 w-full rounded-2xl border border-border bg-background pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
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

            {notice && (
              <p
                role="status"
                className="rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand animate-fade-in"
              >
                {notice}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in"
              >
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

