import { FAMILY_VIEWS, type FamilyView } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { VIEW_LABEL_KEY } from "./views";

/**
 * Every string the frame's client components show, resolved on the server
 * through t() and passed down as plain props — so the shell's client bundle
 * does not need the admin dictionary.
 */
export interface ShellLabels {
  locale: AdminLocale;
  app: string;
  skip: string;
  menu: string;
  close: string;
  nav: string;
  overview: string;
  families: string;
  views: Record<FamilyView, string>;
  insights: string;
  hidden: string;
  updated: string;
  countsPartial: string;
  countsUnavailable: string;
  searchAny: string;
  search: string;
  account: string;
  language: string;
  currency: string;
  langAr: string;
  langEn: string;
  langArShort: string;
  langEnShort: string;
  sar: string;
  usd: string;
  palTitle: string;
  palFamilies: string;
  palNav: string;
  palGoOverview: string;
  palMove: string;
  palOpen: string;
  palClose: string;
  palNoMatch: string;
  palNoMatchHint: string;
  palLoading: string;
  palUnavailable: string;
  /** Contains {shown} and {total}. */
  palShowing: string;
  unnamed: string;
  resultsCount: string;
}

export function shellLabels(locale: AdminLocale): ShellLabels {
  const views = {} as Record<FamilyView, string>;
  for (const view of FAMILY_VIEWS) views[view] = t(VIEW_LABEL_KEY[view], locale);
  return {
    locale,
    app: t("app_title", locale),
    skip: t("sh_skip", locale),
    menu: t("sh_menu", locale),
    close: t("sh_close", locale),
    nav: t("nav_label", locale),
    overview: t("nav_overview", locale),
    families: t("sh_families", locale),
    views,
    insights: t("nav_insights", locale),
    hidden: t("sh_hidden", locale),
    updated: t("sh_updated", locale),
    countsPartial: t("sh_counts_partial", locale),
    countsUnavailable: t("sh_counts_unavailable", locale),
    searchAny: t("sh_search_any", locale),
    search: t("sh_search", locale),
    account: t("sh_account", locale),
    language: t("sh_language", locale),
    currency: t("sh_currency", locale),
    langAr: t("sh_lang_ar", locale),
    langEn: t("sh_lang_en", locale),
    langArShort: t("sh_lang_ar_short", locale),
    langEnShort: t("sh_lang_en_short", locale),
    sar: t("currency_label", locale),
    usd: t("currency_usd_label", locale),
    palTitle: t("sh_pal_title", locale),
    palFamilies: t("sh_pal_families", locale),
    palNav: t("sh_pal_nav", locale),
    palGoOverview: t("sh_pal_go_overview", locale),
    palMove: t("sh_pal_move", locale),
    palOpen: t("sh_pal_open", locale),
    palClose: t("sh_pal_close", locale),
    palNoMatch: t("sh_pal_no_match", locale),
    palNoMatchHint: t("sh_pal_no_match_hint", locale),
    palLoading: t("sh_pal_loading", locale),
    palUnavailable: t("sh_pal_unavailable", locale),
    palShowing: t("sh_pal_showing", locale),
    unnamed: t("sh_unnamed", locale),
    resultsCount: t("sh_results_count", locale),
  };
}
