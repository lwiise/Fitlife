// Client-safe share-text builder — NO server imports allowed in this module.
// It is pulled into the ShareWeekButton client bundle; anything server-only
// (supabase/server, getLatestPlan, next/headers) must stay in recap.ts.

const AR_NUM = new Intl.NumberFormat("ar-SA", { useGrouping: false });

/**
 * The WhatsApp share text — POSITIVES ONLY by construction: counts of cooked
 * and guest days and nothing else. This function deliberately does not accept
 * the full recap (no weight, no skips, no member detail can leak into it).
 */
export function buildShareText(input: {
  cooked_days: number;
  guest_days: number;
}): string {
  const parts: string[] = [];
  if (input.cooked_days > 0) {
    parts.push(`${AR_NUM.format(input.cooked_days)} أيام من مطبخنا`);
  }
  if (input.guest_days > 0) {
    parts.push(
      input.guest_days === 1 ? "وليلة كرم" : `و${AR_NUM.format(input.guest_days)} ليالي كرم`,
    );
  }
  const body = parts.length > 0 ? parts.join(" ") : "أسبوع جديد مع خطة بيتنا";
  return `أسبوعنا مع فت لايف: ${body} — fitlife-app-mvp.netlify.app`;
}
