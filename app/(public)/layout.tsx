import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
        🚧 Preview build — saved results, audio dictations, and accounts are
        under progress. Typing practice works now.
      </div>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
