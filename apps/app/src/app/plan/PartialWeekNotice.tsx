/**
 * «بقية أيام الأسبوع قيد التحضير» — shown when the week came back short.
 *
 * A large household can exceed what one background invocation fits inside its
 * 15-minute budget, so the engine now stops while it still has room and hands
 * back the days it finished (packages/plan-engine/src/budget.ts). The remaining
 * days are filled by DeferredMemberDrain in follow-up runs, with no action from
 * her — but a half-filled week with no explanation reads as a broken product,
 * so we say what is happening.
 *
 * Deliberately calm and free of urgency: nothing is wrong, and there is nothing
 * for her to do. No spinner — the days simply appear.
 */
export function PartialWeekNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-brand-purple-900/15 bg-brand-lavender/20 px-4 py-3.5"
    >
      <p className="font-bold text-brand-ink text-sm leading-relaxed">
        بقية أيام الأسبوع قيد التحضير الآن.
      </p>
      <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
        ستظهر خلال دقائق دون أي إجراء منكِ.
      </p>
    </div>
  );
}
