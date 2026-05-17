import { BRAND_NAME } from "@fitlife/config";
import { Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-surface px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-purple-900/10 px-4 py-2 text-sm font-bold text-brand-purple-900">
          <Sparkles className="size-4" aria-hidden="true" />
          قريباً
        </div>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-brand-ink md:text-5xl">
          {BRAND_NAME.ar}
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-brand-ink-muted">
          خطتك على بعد دقيقتين.
        </p>

        <p className="mt-2 text-sm text-brand-ink-muted/70">
          نحضّر تطبيقك الآن — تابعينا قريباً.
        </p>
      </div>
    </main>
  );
}
