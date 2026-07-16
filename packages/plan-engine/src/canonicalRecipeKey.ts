/**
 * Canonical recipe identity for engagement events (meal_verdicts, vetoes,
 * golden dishes).
 *
 * Meals in plan_data carry NO stable ids — a regenerated plan can re-word
 * «كبسة دجاج» as «كبسة الدجاج بالفريكة». Family verdicts must survive that
 * churn, so they key on a normalized fingerprint of the Arabic recipe name,
 * minted server-side at write time (never re-derived ad hoc in the UI).
 *
 * Scope of "same dish": aggregation-grade identity («هل هذا نفس الطبق؟» for
 * golden-dish counting and veto grouping). Preparation words are IDENTITY
 * (a veto on مقلي must not kill مشوي); only connectors, the definite article,
 * and praise adjectives are noise. Generation-side veto matching stays fuzzy
 * inside the prompt, so a false split here costs little.
 *
 * Bump CANONICAL_KEY_VERSION if the algorithm changes — raw recipe_name_ar is
 * stored beside every key precisely so old rows can be re-minted.
 */
export const CANONICAL_KEY_VERSION = 1;

// Harakat, Quranic annotation marks, superscript alef, tatweel.
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

// Everything that is not Arabic letters, Latin letters, or whitespace → space.
const NON_LETTERS = /[^ء-يa-z\s]/g;

// Tokens that never carry dish identity. Deliberately conservative:
// preparation styles (مشوي/مقلي/بالفرن) are NOT stopwords — they distinguish
// real dishes. Entries are matched AFTER character normalization (ة→ه, ى→ي).
const STOPWORDS = new Set([
  "مع",
  "و",
  "او",
  "على",
  "في",
  "من",
  "طبق",
  "وجبه",
  "صحي",
  "صحيه",
  "لذيذ",
  "لذيذه",
  "شهي",
  "شهيه",
  "طازج",
  "طازجه",
  "منزلي",
  "منزليه",
  // Portion metadata occasionally emitted inside recipe names.
  "حصه",
  "حصص",
]);

function normalizeToken(raw: string): string {
  let t = raw;
  // Unambiguous compound prefixes first (بالـ = "with the", والـ, فالـ, كالـ, للـ).
  t = t.replace(/^(بال|وال|فال|كال|لل)/, "");
  // Bare definite article — only when something meaningful remains.
  if (t.length >= 4 && t.startsWith("ال")) t = t.slice(2);
  return t;
}

/**
 * Deterministic, order-independent fingerprint of an Arabic recipe name.
 * Returns "" for names that normalize to nothing (caller should treat that
 * as "no identity" and skip persistence).
 */
export function canonicalRecipeKey(recipeNameAr: string): string {
  const normalized = recipeNameAr
    .normalize("NFC")
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    // Orthographic unification: alef variants, ya/alef-maqsura, ta-marbuta,
    // hamza carriers. «كبسه» and «كبسة» are the same word typed two ways.
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(NON_LETTERS, " ");

  const tokens = normalized
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  // Sorted so «كبسة الدجاج بالفريكة» === «كبسة الفريكة بالدجاج».
  return [...new Set(tokens)].sort().join(" ");
}
