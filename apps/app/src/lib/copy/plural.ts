// Arabic counted-noun agreement.
//
// Arabic does not pluralise like English. A counted noun changes form across
// SIX categories, and the numeral itself is dropped for one and two:
//
//   1  → يوم واحد        (not «1 يوم»)
//   2  → يومين           (not «2 يوم»)
//   3-10 → 5 أيام        (plural)
//   11-99 → 15 يوماً     (singular, accusative)
//   100+ → 100 يوم       (singular)
//
// Templating `${n} ${noun}` produces «7 يوم», which reads to a native speaker
// roughly the way "7 day" reads in English — and it was on the trial banner,
// i.e. the screen doing the selling.
//
// Intl.PluralRules("ar") already encodes exactly these categories, so the
// mapping is delegated rather than hand-rolled off a chain of < comparisons.

const AR_PLURAL_RULES = new Intl.PluralRules("ar");

export interface ArabicCountForms {
  /** 0 — falls back to `few` when omitted (زر «0 أيام» is idiomatic). */
  zero?: string;
  /** 1 — the numeral is NOT rendered; give the whole phrase («يوم واحد»). */
  one: string;
  /** 2 — the numeral is NOT rendered; give the dual («يومين»). */
  two: string;
  /** 3-10 — rendered as «{n} {few}» («5 أيام»). */
  few: string;
  /** 11-99 — rendered as «{n} {many}» («15 يوماً»). */
  many: string;
  /** 100+ — rendered as «{n} {other}» («100 يوم»). */
  other: string;
}

/**
 * Render a counted noun in Arabic, e.g. `countAr(7, DAY_FORMS)` → «7 أيام».
 *
 * one/two return their phrase alone, because Arabic states the count through
 * the noun's own form there; every other category is prefixed with the digits.
 */
export function countAr(n: number, forms: ArabicCountForms): string {
  switch (AR_PLURAL_RULES.select(n)) {
    case "zero":
      return `${n} ${forms.zero ?? forms.few}`;
    case "one":
      return forms.one;
    case "two":
      return forms.two;
    case "few":
      return `${n} ${forms.few}`;
    case "many":
      return `${n} ${forms.many}`;
    default:
      return `${n} ${forms.other}`;
  }
}

/** يوم — for trial countdowns. */
export const DAY_FORMS: ArabicCountForms = {
  one: "يوم واحد",
  two: "يومين",
  few: "أيام",
  many: "يوماً",
  other: "يوم",
};

/** شخص — for tier headcount limits. */
export const PERSON_FORMS: ArabicCountForms = {
  one: "شخص واحد",
  two: "شخصين",
  few: "أشخاص",
  many: "شخصاً",
  other: "شخص",
};
