import type { AdminLocale } from "./format";

/**
 * The separator for the admin console's TEXT-ONLY places — an aria-label, a
 * title, a placeholder, an <option>, a live-region message, a string a model
 * builds for any of those: wherever the visible UI's <Sep/> rule
 * (app/admin/_ui/Sep.tsx) cannot go because the text cannot hold an element.
 *
 * Arabic takes the Arabic comma, never «·»: beside an Arabic-Indic digit a
 * middle dot reads as the digit zero «٠» («١٤ عائلة · ٧ مدفوعة» reads
 * «٧٠ مدفوعة»). English digits have no such twin, so English keeps « · ».
 */
const LIST_SEP: Readonly<Record<AdminLocale, string>> = { ar: "، ", en: " · " };

/** «، » in Arabic, « · » in English. */
export function listSep(locale: AdminLocale): string {
  return LIST_SEP[locale];
}

/**
 * Text parts joined with `listSep`. Empty parts (null, undefined, false, "")
 * are dropped, so optional parts need no filtering at the call site.
 */
export function joinText(
  parts: ReadonlyArray<string | null | undefined | false>,
  locale: AdminLocale,
): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(listSep(locale));
}
