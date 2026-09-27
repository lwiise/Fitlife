import Link from "next/link";
import { Scale, ChevronLeft } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group -mx-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border-b border-brand-line px-2 py-3 last:border-0 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple-900"
    >
      <span className="text-base font-bold text-brand-ink group-hover:text-brand-purple-900">
        {label}
      </span>
      <ChevronLeft
        className="size-5 text-brand-ink-muted group-hover:text-brand-purple-900"
        aria-hidden="true"
      />
    </Link>
  );
}

export function LegalSection() {
  return (
    <Card aria-labelledby="legal-section-title">
      <CardHeader
        id="legal-section-title"
        title="المستندات القانونية"
        icon={<Scale className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      <div>
        <LinkRow href="/privacy" label="سياسة الخصوصية" />
        <LinkRow href="/terms" label="شروط الاستخدام" />
      </div>
    </Card>
  );
}
