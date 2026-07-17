"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const AR_DATE = new Intl.DateTimeFormat("ar-SA", {
  day: "numeric",
  month: "short",
});

/**
 * Progress photos, MASKED by default — the same deliberate-reveal stance as
 * the last-weight chip: this phone gets handed to children and the
 * housekeeper, so photos never render until an explicit tap, and collapse
 * again on a second tap.
 *
 * Plain <img> on purpose: the URLs are short-lived SIGNED links into the
 * private bucket — routing them through the next/image optimizer would copy
 * private photos into the optimizer's shared cache.
 */
export function PhotoStrip({
  photos,
}: {
  photos: Array<{ recorded_on: string; url: string }>;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <section
      aria-label="صور المسار"
      className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-brand-ink">صور المسار</h2>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-pressed={revealed}
          className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-bold text-brand-purple-900 hover:bg-brand-lavender/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
        >
          {revealed ? (
            <>
              <EyeOff className="size-4" aria-hidden="true" />
              إخفاء
            </>
          ) : (
            <>
              <Eye className="size-4" aria-hidden="true" />
              عرض الصور
            </>
          )}
        </button>
      </div>

      {revealed ? (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((p) => (
            <li key={p.url} className="space-y-1.5">
              <img
                src={p.url}
                alt={`صورة المتابعة بتاريخ ${AR_DATE.format(new Date(`${p.recorded_on}T00:00:00`))}`}
                width={160}
                height={213}
                loading="lazy"
                className="w-full aspect-[3/4] object-cover rounded-xl border border-brand-ink/10"
              />
              <p className="text-xs text-brand-ink-muted text-center">
                {AR_DATE.format(new Date(`${p.recorded_on}T00:00:00`))}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-ink-muted leading-relaxed">
          الصور مخفية — تظهر بلمسة منك فقط.
        </p>
      )}
    </section>
  );
}
