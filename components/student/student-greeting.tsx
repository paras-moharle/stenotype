'use client';

import { useAuth } from '@/lib/use-auth';
import { StudentHeader } from './student-header';

/**
 * Dashboard greeting bound to the live mock session.
 *
 * The dashboard page is a server component; this thin client
 * wrapper injects the dynamic "Welcome back, <name>" into the
 * existing `<StudentHeader>` so we don't have to convert the
 * whole page to a client component.
 *
 * When the real backend session replaces `useAuth`,
 * this file is the only place that needs to change.
 */
export function StudentGreeting({
  description,
}: {
  description?: string;
}) {
  const { user } = useAuth();
  const firstName =
    user?.name?.split(' ')[0] ?? user?.email ?? 'there';
  return (
    <StudentHeader
      title={`Welcome back, ${firstName}`}
      description={description}
    />
  );
}