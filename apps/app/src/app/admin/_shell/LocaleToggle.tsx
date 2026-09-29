"use client";

import { useFormStatus } from "react-dom";
import type { AdminLocale } from "@/lib/admin/format";
import { setAdminLocale } from "../actions";
import { FlagSaudi, FlagUSA } from "./Flags";
import type { ShellLabels } from "./labels";
import { stampReturnPath, useReturnPath } from "./useReturnPath";

type Labels = Pick<ShellLabels, "language" | "langAr" | "langEn" | "langArShort" | "langEnShort">;

/**
 * ar | EN switch. A plain form around the existing setAdminLocale server
 * action (cookie + redirect back to `next`), so it also works before
 * hydration. While the action runs the control shows the chosen language
 * pressed, dims and reports aria-busy.
 */
export function LocaleToggle({ locale, labels }: { locale: AdminLocale; labels: Labels }) {
  const next = useReturnPath();
  return (
    <form action={setAdminLocale} onSubmit={stampReturnPath}>
      <input type="hidden" name="next" value={next} />
      <Options locale={locale} labels={labels} />
    </form>
  );
}

function Options({ locale, labels }: { locale: AdminLocale; labels: Labels }) {
  const { pending, data } = useFormStatus();
  const shown: AdminLocale = pending && data ? (data.get("locale") === "en" ? "en" : "ar") : locale;
  return (
    <div className="ad-seg" role="group" aria-label={labels.language} aria-busy={pending || undefined}>
      <button
        type="submit"
        name="locale"
        value="ar"
        aria-pressed={shown === "ar"}
        aria-label={labels.langAr}
        title={labels.langAr}
      >
        <FlagSaudi />
        <span lang="ar" aria-hidden="true">
          {labels.langArShort}
        </span>
      </button>
      <button
        type="submit"
        name="locale"
        value="en"
        aria-pressed={shown === "en"}
        aria-label={labels.langEn}
        title={labels.langEn}
      >
        <FlagUSA />
        <span lang="en" aria-hidden="true">
          {labels.langEnShort}
        </span>
      </button>
    </div>
  );
}
