import Link from 'next/link';
import { Github, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AboutPage() {
  return (
    <div className="container-page py-16 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl text-balance">
          StenoType
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-balance">
          A focused digital practice platform for stenography students.
        </p>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Built to extend dictation, transcription, and typing practice between
          your regular stenography classes.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-2xl">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
              Built by
            </p>
            <p className="text-base font-medium text-foreground">Paras Moharle</p>
            <a
              href="https://github.com/paras-moharle"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" strokeWidth={1.5} />
              github.com/paras-moharle
            </a>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-brand">
              Contact
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="tel:+917666286532"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                +91 7666286532
              </a>
              <a
                href="tel:+919673002886"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                +91 9673002886
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <Button asChild size="lg" className="group">
            <Link href="/typing">
              Start Practicing
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} StenoType. Built by Paras Moharle.
        </p>
      </div>
    </div>
  );
}
