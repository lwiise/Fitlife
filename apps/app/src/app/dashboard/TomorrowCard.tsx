import Link from "next/link";
import { arNum } from "@/lib/copy/numbers";
import { countAr, DISH_FORMS } from "@/lib/copy/plural";
import type { TodayRow } from "@/lib/dashboard/todayTable";

/** «سفرة الغد» — in the evening (or once today is answered), what tomorrow
 * holds, read-only, so the kitchen can plan ahead. Only when tomorrow is still
 * inside the plan week. */
export function TomorrowCard({ dayName, rows }: { dayName: string; rows: TodayRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="tomorrow-title" className="rounded-[1.375rem] bg-brand-tint p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tomorrow-title" className="text-app-section text-brand-ink">
          سفرة الغد، {dayName}
        </h2>
        <span className="text-meta text-brand-ink-muted">{countAr(rows.length, DISH_FORMS, arNum)}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-3 text-[15px]">
            <span className="w-24 shrink-0 text-meta leading-6 text-brand-ink-muted">{r.slotLabel}</span>
            <span className="min-w-0 font-bold text-brand-ink">{r.recipeName}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/plan"
        className="-ms-2 mt-2 inline-flex min-h-11 items-center rounded-full px-2 text-[15px] font-bold text-brand-purple-900 hover:bg-brand-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        المقادير في الخطة
      </Link>
    </section>
  );
}
