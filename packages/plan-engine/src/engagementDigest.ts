/**
 * Engagement digest — «خطة تشبهك».
 *
 * Turns the household's REAL week (meal_checkins + meal_verdicts rows) into a
 * bounded skeleton-prompt block so next week's plan visibly adapts, and into
 * the instruction to emit `week_changes[]` («سارة عدّلت خطتك» cards).
 *
 * Contract (product/engagement-layer-brainstorm.md §3/§4.3):
 *  - MINIMUM SIGNAL: below MIN_SIGNAL_EVENTS real events the digest is
 *    undefined and NOTHING renders — silence beats fabricated insight.
 *  - Every claim the model may cite must be derivable from the counts given
 *    here; the block never editorializes beyond the data.
 *  - Adaptation, never reproach: the prompt frames skips as design input
 *    («اجعلي الفطور أخف»), not as the user's failures.
 *  - Vetoes are HARD avoid-clauses; golden dishes are a REQUIRED include.
 *  - Bounded: caps below keep the whole block ~≤500 tokens; it lives in the
 *    per-request dynamic prompt, never inside the cached STATIC_SYSTEM.
 *
 * The aggregation takes RAW ROWS so both generation paths share it: the app
 * fetches via supabase-js, the background function via PostgREST fetch — each
 * maps rows to these minimal shapes and calls computeEngagementDigest.
 */

import { canonicalRecipeKey } from "./canonicalRecipeKey";

/** Minimum real events (check-ins + verdicts) before any digest exists. */
export const MIN_SIGNAL_EVENTS = 5;
/** A dish becomes "golden" at this many loved verdicts across the household. */
export const GOLDEN_LOVED_THRESHOLD = 3;
export const MAX_GOLDEN_DISHES = 2;
export const MAX_VETOES = 6;
export const MAX_WEEK_CHANGES = 3;

export interface EngagementCheckinRow {
  slot: string;
  status: string; // "cooked" | "swapped" | "skipped" (Zod-validated upstream)
  reason: string | null;
}

export interface EngagementVerdictRow {
  recipe_name_ar: string;
  canonical_key: string;
  verdict: string; // "loved" | "fine" | "not_again"
}

export interface EngagementDigest {
  total_events: number;
  cooked_count: number;
  swapped_count: number;
  /** status='skipped' counts per slot, only slots with ≥2 skips. */
  skipped_by_slot: Record<string, number>;
  /** reason counts across swapped+skipped (guests, ordered_in, …). */
  reasons: Record<string, number>;
  /** ≥GOLDEN_LOVED_THRESHOLD loved verdicts — MUST reappear in the plan. */
  golden_dishes: Array<{ recipe_name_ar: string; canonical_key: string; loved_count: number }>;
  /** any not_again verdict — MUST NOT reappear. */
  vetoes: Array<{ recipe_name_ar: string; canonical_key: string; count: number }>;
}

/**
 * Aggregate raw event rows into a digest, or undefined below the signal floor.
 * Never throws on malformed rows — bad rows are just skipped.
 */
export function computeEngagementDigest(
  checkins: EngagementCheckinRow[],
  verdicts: EngagementVerdictRow[],
): EngagementDigest | undefined {
  const total = checkins.length + verdicts.length;
  if (total < MIN_SIGNAL_EVENTS) return undefined;

  let cooked = 0;
  let swapped = 0;
  const skippedBySlot: Record<string, number> = {};
  const reasons: Record<string, number> = {};

  for (const c of checkins) {
    if (c.status === "cooked") cooked++;
    else if (c.status === "swapped") swapped++;
    else if (c.status === "skipped") {
      skippedBySlot[c.slot] = (skippedBySlot[c.slot] ?? 0) + 1;
    }
    if (c.reason && c.status !== "cooked") {
      reasons[c.reason] = (reasons[c.reason] ?? 0) + 1;
    }
  }
  // Only patterns (≥2) are worth adapting to — a single skip is noise.
  for (const slot of Object.keys(skippedBySlot)) {
    if ((skippedBySlot[slot] ?? 0) < 2) delete skippedBySlot[slot];
  }

  const bykey = new Map<
    string,
    { recipe_name_ar: string; loved: number; not_again: number }
  >();
  for (const v of verdicts) {
    const key = v.canonical_key || canonicalRecipeKey(v.recipe_name_ar);
    if (!key) continue;
    const entry = bykey.get(key) ?? {
      recipe_name_ar: v.recipe_name_ar,
      loved: 0,
      not_again: 0,
    };
    if (v.verdict === "loved") entry.loved++;
    else if (v.verdict === "not_again") entry.not_again++;
    bykey.set(key, entry);
  }

  const golden_dishes = [...bykey.entries()]
    .filter(([, e]) => e.loved >= GOLDEN_LOVED_THRESHOLD && e.not_again === 0)
    .sort((a, b) => b[1].loved - a[1].loved)
    .slice(0, MAX_GOLDEN_DISHES)
    .map(([canonical_key, e]) => ({
      recipe_name_ar: e.recipe_name_ar,
      canonical_key,
      loved_count: e.loved,
    }));

  const vetoes = [...bykey.entries()]
    .filter(([, e]) => e.not_again >= 1)
    .sort((a, b) => b[1].not_again - a[1].not_again)
    .slice(0, MAX_VETOES)
    .map(([canonical_key, e]) => ({
      recipe_name_ar: e.recipe_name_ar,
      canonical_key,
      count: e.not_again,
    }));

  return {
    total_events: total,
    cooked_count: cooked,
    swapped_count: swapped,
    skipped_by_slot: skippedBySlot,
    reasons,
    golden_dishes,
    vetoes,
  };
}

const SLOT_LABELS_AR: Record<string, string> = {
  breakfast: "الفطور",
  lunch: "الغداء",
  dinner: "العشاء",
  snack: "الوجبات الخفيفة",
};

const REASON_LABELS_AR: Record<string, string> = {
  guests: "ضيوف",
  ordered_in: "طلب خارجي",
  ate_out: "أكل خارج البيت",
  missing_ingredients: "مكونات غير متوفرة",
  no_time: "ضيق وقت",
};

function arabicCount(n: number): string {
  return new Intl.NumberFormat("ar-SA", { useGrouping: false }).format(n);
}

/**
 * The skeleton-prompt block. Empty string when there is no digest — callers
 * concatenate unconditionally, exactly like feedbackText().
 */
export function engagementText(digest: EngagementDigest | undefined): string {
  if (!digest) return "";

  const lines: string[] = [];

  const skippedEntries = Object.entries(digest.skipped_by_slot);
  if (skippedEntries.length > 0) {
    for (const [slot, count] of skippedEntries) {
      lines.push(
        `- ${SLOT_LABELS_AR[slot] ?? slot}: فات ${arabicCount(count)} مرات — اجعلي هذه الوجبة أسرع تحضيراً وأبسط هذا الأسبوع.`,
      );
    }
  }
  const reasonEntries = Object.entries(digest.reasons).sort((a, b) => b[1] - a[1]);
  if (reasonEntries.length > 0) {
    lines.push(
      `- أسباب الخروج عن الخطة: ${reasonEntries
        .map(([r, c]) => `${REASON_LABELS_AR[r] ?? r} (${arabicCount(c)})`)
        .join("، ")} — إن تكرر الضيوف/الأكل خارج البيت فاجعلي أحد العشاءات مرناً وسهل التأجيل.`,
    );
  }
  if (digest.cooked_count > 0) {
    lines.push(`- وجبات طُبخت كما خُطط لها: ${arabicCount(digest.cooked_count)}.`);
  }

  const golden = digest.golden_dishes
    .map((g) => `«${g.recipe_name_ar}»`)
    .join("، ");
  const vetoed = digest.vetoes.map((v) => `«${v.recipe_name_ar}»`).join("، ");

  const sections: string[] = [
    `\n\n# ما حدث فعلياً في أسبوع العائلة الماضي (بيانات حقيقية من تسجيل العميلة)`,
  ];
  if (lines.length > 0) sections.push(lines.join("\n"));
  if (golden) {
    sections.push(
      `الأطباق الذهبية (أحبتها العائلة): ${golden}. **أدرجي كلاً منها مرة هذا الأسبوع بنفس الاسم تقريباً.**`,
    );
  }
  if (vetoed) {
    sections.push(
      `أطباق مرفوضة نهائياً: ${vetoed}. **لا تدرجيها ولا أي طبق شديد الشبه بها.**`,
    );
  }
  sections.push(
    `بناءً على ما سبق فقط، أضيفي في أعلى الـJSON مفتاح week_changes: حتى ${arabicCount(MAX_WEEK_CHANGES)} تغييرات ملموسة قمتِ بها في هذه الخطة، كل عنصر {change_ar, because_ar} — change_ar يصف التعديل بدفء وإيجاز، وbecause_ar يستشهد بحدث حقيقي من البيانات أعلاه (عدد أو طبق محدد). لا تخترعي ملاحظات ليست في البيانات؛ إن لم يكن هناك ما يستحق فأرجعي week_changes: []. صيغي التغيير كتحسين للعميلة، لا كنقد لها.`,
  );

  return sections.join("\n\n");
}
