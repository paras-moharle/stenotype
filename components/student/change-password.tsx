'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/use-auth';

export function ChangePassword() {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const data = new FormData(event.currentTarget);
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      setError('The new passwords do not match.');
      return;
    }
    active.current = true;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/student/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Could not change the password.');
      await signOut();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not reach the server.');
      active.current = false;
      setPending(false);
    }
  }

  return <details className="panel p-5">
    <summary className="cursor-pointer font-medium">Change password</summary>
    <form onSubmit={submit} className="mt-4 max-w-md space-y-3">
      <p className="text-sm text-muted-foreground">Changing your password signs you out of all sessions.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <label className="block"><span className="field-label">Current password</span>
        <input className="field" name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required />
      </label>
      <label className="block"><span className="field-label">New password</span>
        <input className="field" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      <label className="block"><span className="field-label">Confirm new password</span>
        <input className="field" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      <Button disabled={pending}>{pending ? 'Changing password…' : 'Change password'}</Button>
    </form>
  </details>;
}
