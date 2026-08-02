/**
 * What to tell someone who has used up the advisor's daily allowance.
 *
 * The cap is a ROLLING 24-hour window, not a calendar day, and it is shared by
 * the whole household — one subscription, one allowance. The old message said
 * «تم بلوغ الحد اليومي من الأسئلة. يرجى المحاولة غداً.», which is wrong on both
 * counts: "tomorrow" implies midnight, when in fact the first slot returns
 * exactly 24h after the oldest message, often within the same day; and nothing
 * hinted that a six-person household is sharing one pool, so a mother whose son
 * had been asking questions would read it as her own limit.
 */

/** Round up to whole minutes; a "0 minutes" wait reads as broken. */
function minutesUntil(when: number, now: number): number {
  return Math.max(1, Math.ceil((when - now) / 60_000));
}

/**
 * `oldestInWindowIso` is the timestamp of the earliest message still counting
 * against the cap — its slot is the next one to free. Null when unknown (the
 * lookup failed), in which case we say less rather than guess.
 */
export function dailyCapMessage(
  oldestInWindowIso: string | null,
  now: number = Date.now(),
): string {
  const base =
    "استهلك البيت رصيد الأسئلة اليومي للمستشارة. الرصيد مشترك بين أفراد البيت كلهم.";
  if (!oldestInWindowIso) return `${base} يتجدد تدريجياً خلال الساعات القادمة.`;

  const freeAt = Date.parse(oldestInWindowIso) + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(freeAt)) return `${base} يتجدد تدريجياً خلال الساعات القادمة.`;
  if (freeAt <= now) return `${base} يمكنك المحاولة الآن.`;

  const mins = minutesUntil(freeAt, now);
  if (mins < 60) return `${base} أول سؤال جديد متاح بعد ${mins} دقيقة.`;

  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  const when =
    rem === 0 ? `${hours} ساعة` : `${hours} ساعة و${rem} دقيقة`;
  return `${base} أول سؤال جديد متاح بعد ${when}.`;
}
