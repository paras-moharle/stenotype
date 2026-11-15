import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';
import { PreviewBanner } from '@/components/site/preview-banner';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PreviewBanner />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
