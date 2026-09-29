import { FAMILY_VIEWS, type ConsoleNavData, type FamilyView } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";

/**
 * What the frame's client pieces receive: ConsoleNavData with its display
 * strings already formatted on the server, so the Arabic-Indic digits and the
 * Riyadh clock time are rendered once, identically for SSR and hydration
 * (Node's and the browser's ICU can disagree on spacing in times).
 */
export interface ShellNav {
  counts: Record<FamilyView, number>;
  /** Counts formatted for the UI language. */
  countText: Record<FamilyView, string>;
  /** loadedAt as a Riyadh wall-clock time, e.g. «٢:٣٢ م». */
  updatedText: string;
  /** Some table hit the load ceiling — counts may undercount. */
  partial: boolean;
  families: ConsoleNavData["searchIndex"];
}

const TAG: Record<AdminLocale, string> = { ar: "ar-SA", en: "en-US" };

export function toShellNav(data: ConsoleNavData, locale: AdminLocale): ShellNav {
  const nf = new Intl.NumberFormat(TAG[locale]);
  const counts = {} as Record<FamilyView, number>;
  const countText = {} as Record<FamilyView, string>;
  for (const view of FAMILY_VIEWS) {
    const n = Number(data.counts?.[view] ?? 0);
    counts[view] = Number.isFinite(n) ? n : 0;
    countText[view] = nf.format(counts[view]);
  }
  const loaded = new Date(data.loadedAt);
  const updatedText = Number.isNaN(loaded.getTime())
    ? "—"
    : new Intl.DateTimeFormat(TAG[locale], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Riyadh",
      }).format(loaded);
  return {
    counts,
    countText,
    updatedText,
    partial: (data.truncated?.length ?? 0) > 0,
    families: data.searchIndex ?? [],
  };
}
