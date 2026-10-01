import type { Entry } from "./types";

/**
 * Admin strings for the full family page's own chrome: the page head, the
 * tab bodies' panels, the plan/program/health views and the account tab.
 * (The shared family blocks keep theirs in ./family.ts.) Every key starts
 * with `fp_` so the merged dictionary in ../i18n.ts can never collide with
 * another module's keys.
 *
 * Arabic is written first, in فصحى, operator-facing and without gendered
 * dual forms; the wording follows the approved prototype's copy. `{tab}` is
 * filled by `fill()` (app/admin/_blocks/helpers.ts) with a tab's name.
 *
 * Meanings that already exist elsewhere are reused from there: the panel
 * titles (section_*), the danger zone and its dialog (danger_zone,
 * deactivate_*, delete_*, deleting, action_cancel, account_*), the health
 * fields (field_*, health_*), the plan view note (plan_data_logged_note,
 * plan_no_data), the crumb (sh_families), and the family blocks' words
 * (fm_customer_since, fm_program, fm_earlier_plans, fm_all_plans, …).
 */
export const FAMILY_PAGE_STRINGS = {
  // ── Tabs ──
  fp_tabs: { ar: "أقسام العائلة", en: "Family sections" },
  fp_tab_summary: { ar: "ملخص", en: "Summary" },
  fp_tab_meal: { ar: "الخطة الغذائية", en: "Meal plan" },
  fp_tab_exercise: { ar: "خطة التمارين", en: "Exercise plan" },
  fp_tab_household: { ar: "الأسرة والصحة", en: "Household & health" },
  fp_tab_billing: { ar: "الاشتراك", en: "Billing" },
  fp_tab_runs: { ar: "سجل الإنشاء", en: "AI runs" },
  fp_tab_account: { ar: "إجراءات الحساب", en: "Account actions" },
  // A link's accessible name when its visible text is only «فتح» or a tab's name.
  fp_go_tab: { ar: "فتح قسم {tab}", en: "Open {tab}" },
  fp_open: { ar: "فتح", en: "Open" },
  fp_loading: { ar: "جارٍ تحميل بيانات العائلة…", en: "Loading the family…" },
  fp_loading_tab: { ar: "جارٍ تحميل هذا القسم…", en: "Loading this section…" },
  fp_loading_view: { ar: "جارٍ التحميل…", en: "Loading…" },

  // ── Meal plan tab ──
  fp_current_plan: { ar: "الخطة الحالية", en: "Current plan" },
  fp_open_plan: { ar: "فتح الخطة كاملة", en: "Open full plan" },
  fp_audit_plan: {
    ar: "فتح الخطة يُسجَّل في سجل التدقيق",
    en: "Opening a plan is recorded in the audit log",
  },

  // ── Exercise plan tab ──
  fp_open_program: { ar: "فتح البرنامج كاملاً", en: "Open full program" },
  fp_audit_program: {
    ar: "فتح البرنامج يُسجَّل في سجل التدقيق",
    en: "Opening a program is recorded in the audit log",
  },
  fp_all_programs: { ar: "كل البرامج", en: "All programs" },

  // ── Account actions ──
  fp_reactivate_desc: {
    ar: "يسمح بتسجيل الدخول من جديد، ولا يغيّر أي بيانات.",
    en: "Allows sign-in again. No data is changed.",
  },
  fp_deactivating: { ar: "جارٍ التعطيل…", en: "Deactivating…" },
  fp_reactivating: { ar: "جارٍ إعادة التفعيل…", en: "Reactivating…" },
  // The erasure removes exercise programs too; the older delete_item_plans predates them.
  fp_delete_item_plans: {
    ar: "كل الخطط الغذائية وبرامج التمارين وسجل الإنشاء",
    en: "All meal plans, exercise programs and generation history",
  },
  fp_delete_no_email: {
    ar: "تعذّرت قراءة البريد الإلكتروني لهذا الحساب، لذلك لا يمكن تأكيد الحذف الآن.",
    en: "This account’s email couldn’t be read, so deletion can’t be confirmed right now.",
  },
  // Why an account action did not run (_family/model.ts, accountRefusalText);
  // each says plainly that nothing was changed.
  fp_refused_admin_target: {
    ar: "هذا حساب مشرف، وحسابات المشرفين لا تُعطَّل ولا تُحذف من لوحة التحكم. لم يتغيّر شيء.",
    en: "This is an admin account. Admin accounts can’t be deactivated or deleted from the console. Nothing was changed.",
  },
  fp_refused_admin_check: {
    ar: "تعذّر التحقق من أن هذا الحساب ليس حساب مشرف، فأُوقف الإجراء ولم يتغيّر شيء. يمكن المحاولة مرة أخرى بعد قليل.",
    en: "Couldn’t confirm that this isn’t an admin account, so the action was stopped and nothing was changed. Try again in a moment.",
  },
  fp_refused_email_mismatch: {
    ar: "البريد المكتوب لا يطابق بريد هذا الحساب كما هو مسجَّل الآن، فلم يُحذف شيء. إن كان البريد قد تغيّر فستُظهره الصفحة بعد إعادة تحميلها.",
    en: "The email typed doesn’t match this account’s current email, so nothing was deleted. If the email has changed, reloading the page shows it.",
  },

  // ── Plan and program views ──
  fp_family_page: { ar: "صفحة العائلة", en: "Family page" },
  fp_read_only: {
    ar: "عرض للقراءة فقط بنفس شاشة العميل",
    en: "Read-only, the same screen the family sees",
  },
  fp_program_title: { ar: "برنامج التمارين", en: "Exercise program" },
  fp_plan_unavailable: { ar: "لا يمكن عرض هذه الخطة", en: "This plan can’t be shown" },
  fp_program_unavailable: { ar: "لا يمكن عرض هذا البرنامج", en: "This program can’t be shown" },
  fp_program_no_data: {
    ar: "لا يوجد محتوى للبرنامج بعد (لم يُنشأ أو فشل).",
    en: "No program content yet (not generated or failed).",
  },
  fp_program_logged: {
    ar: "تم تسجيل عرض برنامج المشترك في سجل التدقيق.",
    en: "Viewing the subscriber’s program is recorded in the audit log.",
  },
} as const satisfies Record<string, Entry>;
