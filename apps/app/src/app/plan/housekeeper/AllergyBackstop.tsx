import { AlertTriangle } from "lucide-react";
import type { LocaleCode } from "@fitlife/plan-engine";
import { getPlanStrings } from "@/lib/plans/locales";

export interface AllergyEntry {
  name: string;
  // The member's name rendered in the cook's script (from the plan's translation
  // pass). Falls back to the Arabic `name` until transliteration lands.
  nameTranslated?: string;
  allergies: string[];
}

/**
 * Cook-facing allergy backstop for the maid view. Each beneficiary's recorded
 * allergies come straight from the DB (profiles/family_members), NEVER from the
 * recipe prose or plan_data. The warning chrome is localized to the maid's
 * language; the allergen terms are user-entered Arabic, so they render verbatim
 * (dir="rtl"). The member NAME uses the transliterated form when available so a
 * non-Arabic cook can tell whose allergy each line is. Display-only.
 */
export function AllergyBackstop({
  entries,
  locale,
}: {
  entries: AllergyEntry[];
  locale: LocaleCode;
}) {
  const withAllergies = entries.filter((e) => e.allergies.length > 0);
  if (withAllergies.length === 0) return null;

  const t = getPlanStrings(locale);

  // Critical tone from the redesign's Notice palette, hand-built rather than a
  // <Notice>: this is a standing kitchen rule, not a live alert — it keeps its
  // `note` role and a real <h2> (Notice's title is a <p>, and its critical tone
  // would announce as role="alert" on every poll-driven refresh).
  return (
    <section
      role="note"
      aria-label={t.allergy_title}
      className="rounded-2xl border border-critical/25 bg-critical-soft px-4 py-3.5 md:px-5 md:py-4"
    >
      <h2 className="flex items-center gap-2 text-app-section text-critical">
        <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
        {t.allergy_title}
      </h2>
      <ul className="mt-3 space-y-3">
        {withAllergies.map((entry, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="font-bold text-brand-ink">
              <span className="font-medium text-brand-ink-muted">{t.allergy_for} </span>
              {entry.nameTranslated ? (
                <span>{entry.nameTranslated}</span>
              ) : (
                <span dir="rtl" lang="ar">{entry.name}</span>
              )}
            </span>
            {entry.allergies.map((allergen, j) => (
              <span
                key={j}
                dir="rtl"
                lang="ar"
                className="inline-flex items-center rounded-lg border border-critical/30 bg-brand-card px-2.5 py-1 text-[15px] font-bold text-brand-ink"
              >
                {allergen}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[15px] leading-relaxed text-brand-ink-muted">{t.allergy_disclaimer}</p>
    </section>
  );
}
