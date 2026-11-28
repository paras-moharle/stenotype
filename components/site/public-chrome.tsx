import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { AuthProvider, type AppUser } from '@/lib/auth-provider';

export function PublicChrome({ children, initialUser }: {
  children: React.ReactNode;
  initialUser?: AppUser | null;
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
