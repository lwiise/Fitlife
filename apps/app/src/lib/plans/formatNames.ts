import type { LocaleCode } from "@fitlife/plan-engine";

/**
 * Join a list of people's names into a natural-language conjunction list for the
 * given locale — used to label who a shared meal is split between.
 *
 * Arabic uses comma separators with the conjunction و attached to the last name
 * ("محمد، أسماء، وأحمد"; two names → "محمد وأسماء"), matching how the wife reads it.
 * Other locales defer to `Intl.ListFormat` for native phrasing
 * ("Mohammed, Asma, and Ahmed").
 */
export function formatNameList(names: string[], locale: LocaleCode = "ar"): string {
  const clean = names.filter((n) => n && n.trim().length > 0);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0]!;

  if (locale === "ar") {
    if (clean.length === 2) return `${clean[0]} و${clean[1]}`;
    const head = clean.slice(0, -1).join("، ");
    return `${head}، و${clean[clean.length - 1]}`;
  }

  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "conjunction",
    }).format(clean);
  } catch {
    return clean.join(", ");
  }
}
