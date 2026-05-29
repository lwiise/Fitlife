import { AlertTriangle } from "lucide-react";
import type { LocaleCode } from "@fitlife/plan-engine";
import { getPlanStrings } from "@/lib/plans/locales";

export interface AllergyEntry {
  name: string;
  allergies: string[];
}

/**
 * Cook-facing allergy backstop for the maid view. Each beneficiary's recorded
 * allergies come straight from the DB (profiles/family_members), NEVER from the
 * recipe prose or plan_data. The warning chrome is localized to the maid's
 * language; the allergen terms and names are user-entered Arabic, so they render
 * verbatim (dir="rtl") rather than being translated. Display-only.
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

  return (
    <section
      role="note"
      aria-label={t.allergy_title}
      className="rounded-2xl border-2 border-brand-pink bg-brand-pink/5 p-4 md:p-5"
    >
      <h2 className="flex items-center gap-2 text-brand-pink font-extrabold text-lg md:text-xl leading-tight">
        <AlertTriangle className="size-5 flex-shrink-0" aria-hidden="true" />
        {t.allergy_title}
      </h2>
      <ul className="mt-3 space-y-3">
        {withAllergies.map((entry, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-brand-ink font-bold">
              <span className="text-brand-ink-muted font-medium">{t.allergy_for} </span>
              <span dir="rtl" lang="ar">{entry.name}</span>
            </span>
            {entry.allergies.map((allergen, j) => (
              <span
                key={j}
                dir="rtl"
                lang="ar"
                className="inline-flex items-center rounded-lg border border-brand-pink/40 bg-white px-2.5 py-1 text-sm font-bold text-brand-ink"
              >
                {allergen}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-brand-ink-muted leading-relaxed">{t.allergy_disclaimer}</p>
    </section>
  );
}
