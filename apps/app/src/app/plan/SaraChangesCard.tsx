import type { MealPlan } from "@fitlife/plan-engine";

// «سارة عدّلت خطتك» — the payoff card for the engagement loop. The skeleton
// emits up to 3 {change_ar, because_ar} pairs in response to the household's
// real logged week (see engagementDigest.ts + schema.ts week_changes); this is
// the first customer-facing surface for that data. Reads as a short, warm note
// from Sara — leads with the adaptation, the evidence sits quietly beneath it,
// never a list of what the family failed to do (contract: engagement-layer
// -brainstorm.md §4.3). Plan-wide, not per-member, so it renders above the
// member tabs. Purely presentational — the minimum-signal guard already ran in
// the engine, so if `changes` is non-empty it is safe to show.
export function SaraChangesCard({
  changes,
}: {
  changes: NonNullable<MealPlan["week_changes"]>;
}) {
  if (changes.length === 0) return null;
  return (
    <section
      aria-labelledby="sara-changes-heading"
      className="bg-brand-lavender/15 border border-brand-purple-900/10 rounded-2xl p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid place-items-center size-9 shrink-0 rounded-full bg-brand-purple-900 text-white font-extrabold text-sm"
        >
          س
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="sara-changes-heading"
            className="font-extrabold text-brand-ink text-base leading-tight"
          >
            سارة عدّلت خطتك
          </h2>
          <p className="text-brand-ink-muted text-xs mt-0.5">
            بناءً على أسبوعك الماضي
          </p>
          <ul className="mt-3 space-y-3">
            {changes.map((c, i) => (
              <li key={i} className="ps-3 border-s-2 border-brand-lavender">
                <p className="text-brand-ink font-bold text-sm leading-relaxed">
                  {c.change_ar}
                </p>
                <p className="text-brand-ink-muted text-xs leading-relaxed mt-0.5">
                  {c.because_ar}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
