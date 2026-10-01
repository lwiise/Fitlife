import type { AdminLocale } from "../format";
import type { Entry } from "./types";

/**
 * Admin strings for the console's error screen (app/admin/_shell/ErrorView),
 * with the two it shares: the way back to the overview (also on the
 * not-found screen) and "try again" (also on the side panel's retry).
 *
 * Its own module because the error screen is a CLIENT component that every
 * admin route loads — both error boundaries render it — and it has no server
 * props to receive resolved labels through. It reads this module directly
 * (`errorString`), so the browser gets these few lines, never the whole
 * dictionary. Merged into ../i18n.ts like every other module, so server code
 * keeps using t() for the same keys.
 */
export const ERROR_STRINGS = {
  sh_error_title: { ar: "تعذّر عرض هذه الصفحة", en: "This page couldn’t be shown" },
  // Two bodies: the reference is only mentioned when there is one to show
  // (Next gives server errors a digest; client-side errors have none).
  sh_error_body: {
    ar: "حدث خطأ غير متوقع أثناء تحميلها، وإعادة المحاولة تكفي عادةً.",
    en: "Something unexpected went wrong while loading it. Trying again usually works.",
  },
  sh_error_body_ref: {
    ar: "حدث خطأ غير متوقع أثناء تحميلها. إعادة المحاولة تكفي عادةً، وإن تكرّر الخطأ فالرمز أدناه يساعد في تتبّعه.",
    en: "Something unexpected went wrong while loading it. Trying again usually works; if it keeps happening, the reference below helps trace it.",
  },
  sh_error_ref: { ar: "رمز الخطأ", en: "Error reference" },
  sh_back_overview: { ar: "العودة إلى نظرة عامة", en: "Back to Overview" },
  retry: { ar: "إعادة المحاولة", en: "Try again" },
} as const satisfies Record<string, Entry>;

export type ErrorStringKey = keyof typeof ERROR_STRINGS;

/** t() for the error screen, without the dictionary. */
export function errorString(key: ErrorStringKey, locale: AdminLocale): string {
  return ERROR_STRINGS[key][locale];
}
