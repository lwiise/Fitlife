"use client";

import { useFormStatus } from "react-dom";
import type { AdminLocale } from "@/lib/admin/format";
import { setAdminLocale } from "../actions";
import { FlagSaudi, FlagUSA } from "./Flags";
import type { ShellLabels } from "./labels";
import { SCRIPTED_FIELD } from "./toggleReturn";
import { markScripted, useReturnPath } from "./useReturnPath";

type Labels = Pick<ShellLabels, "language" | "langAr" | "langEn" | "langArShort" | "langEnShort">;

/**
 * ar | EN switch. A plain form around the setAdminLocale server action, so it
 * also works before hydration (cookie + redirect back to `next`); once the app
 * runs, the action re-renders the route the router is on instead (see
 * toggleReturn.ts). While the action runs the control shows the chosen
 * language pressed, dims and reports aria-busy.
 *
 * Each button is named in its own language — «العربية», "English" — and says
 * so with `lang`, so a screen reader speaks each name with the right voice in
 * either UI language.
 */
export function LocaleToggle({ locale, labels }: { locale: AdminLocale; labels: Labels }) {
  const next = useReturnPath();
  return (
    <form action={setAdminLocale} onSubmit={markScripted}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name={SCRIPTED_FIELD} defaultValue="" />
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
        lang="ar"
        aria-pressed={shown === "ar"}
        aria-label={labels.langAr}
        title={labels.langAr}
      >
        <FlagSaudi />
        <span aria-hidden="true">{labels.langArShort}</span>
      </button>
      <button
        type="submit"
        name="locale"
        value="en"
        lang="en"
        aria-pressed={shown === "en"}
        aria-label={labels.langEn}
        title={labels.langEn}
      >
        <FlagUSA />
        <span aria-hidden="true">{labels.langEnShort}</span>
      </button>
    </div>
  );
}
