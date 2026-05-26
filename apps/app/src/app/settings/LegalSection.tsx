import Link from "next/link";
import { Scale, ChevronLeft } from "lucide-react";

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 min-h-11 py-3 border-b border-brand-ink/5 last:border-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md"
    >
      <span className="text-brand-ink font-bold text-sm group-hover:text-brand-purple-900 transition-colors">
        {label}
      </span>
      <ChevronLeft
        className="size-4 text-brand-ink-muted group-hover:text-brand-purple-900 transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
}

export function LegalSection() {
  return (
    <section className="bg-white rounded-2xl border border-brand-ink/5 p-6 md:p-7">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-full bg-brand-yellow/20 flex items-center justify-center flex-shrink-0">
          <Scale className="size-5 text-brand-yellow-dark" aria-hidden="true" />
        </div>
        <h2 className="font-bold text-lg text-brand-ink">المستندات القانونية</h2>
      </div>

      <div>
        <LinkRow href="/privacy" label="سياسة الخصوصية" />
        <LinkRow href="/terms" label="شروط الاستخدام" />
      </div>
    </section>
  );
}
