import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';
import { findStudentProfile } from './api-guard';

export const getStudentPageProfile = cache(findStudentProfile);

export const requireStudentPage = cache(async () => {
  const current = await getCurrentUser();
  if (!current) redirect('/login');
  if (current.role !== 'student' || current.banned) redirect('/login?denied=1');
  const profile = await getStudentPageProfile(current.id);
  if (profile?.status !== 'ACTIVE') redirect('/login?denied=1');
  return { user: current, profile };
});
