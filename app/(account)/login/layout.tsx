import { PublicChrome } from '@/components/site/public-chrome';
import { getCurrentUser } from '@/lib/session';

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <PublicChrome initialUser={user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'student',
    } : null}>
      {children}
    </PublicChrome>
  );
}
