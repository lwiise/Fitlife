import type { AdminLocale } from "@/lib/admin/format";
import type { EngagementStats } from "@/lib/admin/engagement";

/**
 * Engagement-layer counters under the cost strip. Labels are inline-bilingual
 * (ar/en pairs) rather than i18n-dictionary entries — this strip is v1
 * observability for the engagement rollout; fold into i18n.ts if it stays.
 */
export function EngagementStrip({
  stats,
  locale,
}: {
  stats: EngagementStats;
  locale: AdminLocale;
}) {
  const ar = locale === "ar";
  const nf = new Intl.NumberFormat(ar ? "ar-SA" : "en-US", {
    useGrouping: false,
  });

  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: ar ? "تسجيلات الأيام (٧ أيام)" : "Check-ins (7d)",
      value: nf.format(stats.checkins7d),
    },
    {
      label: ar ? "بيوت نشطة التسجيل (٧ أيام)" : "Active households (7d)",
      value: nf.format(stats.activeCheckinHouseholds7d),
    },
    {
      label: ar ? "آراء الأطباق (٧ أيام)" : "Dish verdicts (7d)",
      value: nf.format(stats.verdicts7d),
    },
    {
      label: ar ? "تسجيلات وزن (٧ أيام)" : "Weigh-ins (7d)",
      value: nf.format(stats.weighIns7d),
    },
    {
      label: ar ? "خطط فيها «سارة عدّلت»" : "Plans with week changes",
      value:
        stats.plansWithChangesPct === null
          ? "—"
          : `${nf.format(stats.plansWithChangesPct)}٪`,
      hint: ar ? "من آخر ٢٥ خطة" : "of last 25 plans",
    },
    {
      label: ar ? "مدفوع تجاوز أول تجديد" : "Paid past 1st renewal",
      value:
        stats.paidTotal > 0
          ? `${nf.format(stats.renewedOnce)}/${nf.format(stats.paidTotal)}`
          : "—",
      hint: ar ? "مؤشر تقريبي — مقياس الطبقة الأول" : "proxy — the layer's headline metric",
    },
  ];

  return (
    <section aria-labelledby="ov-engagement-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="ov-engagement-heading"
          className="text-sm font-bold text-brand-ink"
        >
          {ar ? "طبقة التفاعل" : "Engagement layer"}
        </h2>
        {!stats.eventsAvailable && (
          <span className="text-xs font-bold rounded-full bg-brand-yellow/20 text-brand-ink px-2.5 py-0.5">
            {ar
              ? "الجداول غير مفعّلة — طبّقي 00017"
              : "tables missing — apply migration 00017"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="bg-white rounded-2xl border border-brand-ink/5 p-4"
          >
            <p className="text-2xl font-extrabold text-brand-purple-900 tabular-nums">
              {tile.value}
            </p>
            <p className="text-xs text-brand-ink-muted leading-snug mt-1">
              {tile.label}
            </p>
            {tile.hint && (
              <p className="text-[11px] text-brand-ink-muted/70 leading-snug mt-0.5">
                {tile.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
