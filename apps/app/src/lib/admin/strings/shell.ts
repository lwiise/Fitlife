import type { Entry } from "./types";

/**
 * Admin strings for the console frame — top bar, rail, command palette, toggles.
 * Every key starts with `sh_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 *
 * Arabic is written first and in فصحى, addressed to the operator without any
 * gendered dual forms. Reused meanings live in i18n.ts (app_title, nav_label,
 * nav_overview, nav_insights, currency_label, currency_usd_label, retry…).
 */
export const SHELL_STRINGS = {
  sh_skip: { ar: "تخطٍّ إلى المحتوى", en: "Skip to content" },
  sh_menu: { ar: "القائمة", en: "Menu" },
  sh_close: { ar: "إغلاق", en: "Close" },

  // ── Rail ──
  sh_families: { ar: "العائلات", en: "Families" },
  sh_view_all: { ar: "كل العائلات", en: "All families" },
  sh_view_attention: { ar: "تحتاج متابعة", en: "Needs attention" },
  sh_view_trialing: { ar: "تجريبي", en: "Trialing" },
  sh_view_active: { ar: "نشط", en: "Active" },
  sh_view_past_due: { ar: "متأخر الدفع", en: "Past due" },
  sh_view_cancelling: { ar: "إلغاء مجدول", en: "Cancelling" },
  sh_view_ended: { ar: "منتهية", en: "Ended" },
  sh_hidden: { ar: "مخفية", en: "Hidden" },
  sh_updated: { ar: "آخر تحديث", en: "Updated" },
  sh_counts_partial: {
    ar: "قد تكون الأعداد أقل من الواقع لأن حد التحميل بُلغ.",
    en: "Counts may be low: the load ceiling was reached.",
  },
  sh_counts_unavailable: {
    ar: "تعذّر تحميل الأعداد الآن.",
    en: "Counts couldn’t be loaded right now.",
  },

  // ── Top bar ──
  sh_search_any: {
    ar: "البحث عن أي عائلة بالاسم أو البريد أو المعرّف…",
    en: "Search any family by name, email or ID…",
  },
  sh_search: { ar: "بحث", en: "Search" },
  sh_account: { ar: "حساب المشرف", en: "Admin account" },
  sh_language: { ar: "اللغة", en: "Language" },
  sh_currency: { ar: "العملة", en: "Currency" },
  // Native language names read the same in either UI language on purpose.
  sh_lang_ar: { ar: "العربية", en: "العربية" },
  sh_lang_en: { ar: "English", en: "English" },
  sh_lang_ar_short: { ar: "ع", en: "ع" },
  sh_lang_en_short: { ar: "EN", en: "EN" },

  // ── Command palette ──
  sh_pal_title: { ar: "البحث والتنقل", en: "Search and navigate" },
  sh_pal_families: { ar: "العائلات", en: "Families" },
  sh_pal_nav: { ar: "التنقل", en: "Navigate" },
  sh_pal_go_overview: { ar: "الانتقال إلى نظرة عامة", en: "Go to Overview" },
  sh_pal_move: { ar: "للتنقل", en: "to move" },
  sh_pal_open: { ar: "للفتح", en: "to open" },
  sh_pal_close: { ar: "للإغلاق", en: "to close" },
  sh_pal_no_match: { ar: "لا نتائج مطابقة", en: "No matches" },
  sh_pal_no_match_hint: {
    ar: "يكفي جزء من الاسم أو من البريد الإلكتروني.",
    en: "Try part of the name or the email address.",
  },
  sh_pal_loading: { ar: "جارٍ تحميل قائمة العائلات…", en: "Loading the family list…" },
  sh_pal_unavailable: {
    ar: "تعذّر تحميل قائمة العائلات، والتنقل ما زال متاحاً.",
    en: "The family list couldn’t be loaded; navigation still works.",
  },
  // {shown} and {total} are replaced with formatted numbers.
  sh_pal_showing: {
    ar: "أول {shown} من {total}، والبحث الأدق يضيّق النتائج",
    en: "First {shown} of {total}, refine to narrow down",
  },
  sh_unnamed: { ar: "بدون اسم", en: "No name" },
  sh_results_count: { ar: "عدد النتائج", en: "Results" },

  // The error screen's strings live in ./errors (a client component reads them).

  // ── Not found (inside the console) ──
  sh_not_found_title: { ar: "لم نجد هذه الصفحة", en: "This page wasn’t found" },
  sh_not_found_body: {
    ar: "قد يكون الحساب حُذف، أو أن الرابط غير صحيح.",
    en: "The account may have been deleted, or the link is wrong.",
  },
  sh_back_families: { ar: "العودة إلى العائلات", en: "Back to Families" },
} as const satisfies Record<string, Entry>;
