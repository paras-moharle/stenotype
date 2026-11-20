import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { AuthProvider } from '@/lib/auth-provider';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

