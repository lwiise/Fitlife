import type { Entry } from "./types";

/**
 * Admin strings for the families list, its toolbar and the side panel.
 * Every key starts with `fl_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 *
 * Arabic is written first, in فصحى, operator-facing and without gendered dual
 * forms. `{name}`-style placeholders are filled with already-formatted values
 * (`fill()` in app/admin/_blocks/helpers.ts). Plural families
 * (`fl_n_families_{zero,one,two,few,many,other}`) are picked with
 * Intl.PluralRules; English only ever reaches `_one` and `_other`.
 *
 * Meanings that already exist elsewhere are reused from there: the saved
 * views (sh_view_*), column names (col_tier, col_status, col_household,
 * col_activity, col_ai_cost, col_renewal, col_signup, col_plans), the search
 * placeholder, paging (page_prev, page_next, nav_pagination), retry, the
 * truncation warning, and the family blocks' own words (fm_*) — the panel's
 * head says «مشترك منذ» with the full page's own key (fm_customer_since). The
 * panel's footer has its own wording (fl_open_*), which differs from the
 * full page's.
 */
export const FAMILIES_STRINGS = {
  // ── Table and toolbar ──
  fl_col_family: { ar: "العائلة", en: "Family" },
  fl_meal_plan: { ar: "الخطة الغذائية", en: "Meal plan" },
  fl_exercise_plan: { ar: "خطة التمارين", en: "Exercise plan" },
  fl_tier_all: { ar: "كل الباقات", en: "All tiers" },
  fl_status_all: { ar: "كل الحالات", en: "All statuses" },
  // statusLabel() in ../i18n.ts has no entry for a paused subscription (00023).
  fl_status_paused: { ar: "متوقف مؤقتاً", en: "Paused" },
  fl_columns: { ar: "الأعمدة", en: "Columns" },
  fl_columns_hint: { ar: "اختيار الأعمدة الظاهرة", en: "Choose visible columns" },
  // «٢ فاشلة», after a plan count and a separator.
  fl_failed: { ar: "فاشلة", en: "failed" },
  fl_views: { ar: "قوائم العائلات", en: "Family lists" },
  fl_truncated: {
    ar: "قد تكون القائمة ناقصة، فقد بُلغ حد التحميل في:",
    en: "The list may be incomplete: the load ceiling was reached for",
  },

  // ── The head's count line: «١٠ عائلات», «٦ مدفوعة», «٣ تجريبية», with a separator between ──
  fl_n_families_zero: { ar: "{n} عائلة", en: "{n} families" },
  fl_n_families_one: { ar: "عائلة واحدة", en: "{n} family" },
  fl_n_families_two: { ar: "عائلتان", en: "{n} families" },
  fl_n_families_few: { ar: "{n} عائلات", en: "{n} families" },
  fl_n_families_many: { ar: "{n} عائلة", en: "{n} families" },
  fl_n_families_other: { ar: "{n} عائلة", en: "{n} families" },
  fl_n_paying: { ar: "{n} مدفوعة", en: "{n} paying" },
  fl_n_trial: { ar: "{n} تجريبية", en: "{n} in trial" },

  // ── Footer ──
  fl_range: { ar: "{from}–{to} من {total}", en: "{from}–{to} of {total}" },
  fl_kb_rows: { ar: "التنقل بين الصفوف", en: "move between rows" },
  fl_kb_full: { ar: "الصفحة الكاملة", en: "full page" },
  fl_kb_close: { ar: "إغلاق اللوحة", en: "close panel" },

  // ── Empty states ──
  fl_empty: { ar: "لا توجد عائلات بعد", en: "No families yet" },
  fl_empty_b: {
    ar: "تظهر العائلات هنا بعد أول تسجيل.",
    en: "Families appear here after the first signup.",
  },
  fl_no_match: { ar: "لا توجد عائلات مطابقة", en: "No families match" },
  fl_no_match_b: {
    ar: "لا تطابق أي عائلة البحث وعوامل التصفية الحالية.",
    en: "No family matches the current search and filters.",
  },
  fl_clear_filters: { ar: "مسح عوامل التصفية", en: "Clear filters" },
  fl_view_empty: { ar: "لا توجد عائلات في هذه القائمة", en: "No families in this list" },
  fl_view_empty_b: {
    ar: "تظهر هنا العائلات التي تنطبق عليها هذه القائمة.",
    en: "Families show up here when they fit this list.",
  },
  fl_show_all: { ar: "عرض كل العائلات", en: "Show all families" },

  // ── The side panel ──
  fl_tabs: { ar: "أقسام العائلة", en: "Family sections" },
  fl_tab_summary: { ar: "ملخص", en: "Summary" },
  // An attention reason's link to the tab that resolves it; {tab} is its name.
  fl_go_tab: { ar: "فتح قسم {tab}", en: "Open {tab}" },
  fl_waiting_meals: { ar: "بانتظار الوجبات", en: "Waiting for meals" },
  fl_close_panel: { ar: "إغلاق اللوحة", en: "Close panel" },
  // The footer's primary action names what opens, beside «الصفحة الكاملة».
  fl_open_plan: { ar: "فتح خطة الوجبات", en: "Open meal plan" },
  fl_open_program: { ar: "فتح برنامج التمارين", en: "Open exercise program" },
  fl_full_page: { ar: "الصفحة الكاملة", en: "Full family page" },
  fl_all_programs: { ar: "كل البرامج", en: "All programs" },
  fl_loading_family: { ar: "جارٍ تحميل بيانات العائلة…", en: "Loading the family…" },
  fl_missing: { ar: "لم تعد هذه العائلة موجودة", en: "This family no longer exists" },
  fl_missing_b: {
    ar: "ربما حُذف الحساب بعد تحميل القائمة.",
    en: "The account may have been deleted after the list loaded.",
  },
  fl_load_error: {
    ar: "تعذّر تحميل بيانات هذه العائلة.",
    en: "This family’s details couldn’t be loaded.",
  },
} as const satisfies Record<string, Entry>;
