/**
 * Admin-only i18n dictionary (ar/en). Deliberately DECOUPLED from the consumer
 * 7-locale PlanStrings system — this is operator-facing only. Default is Arabic
 * to match the app; a later phase wires the toggle + persistence and resolves
 * the active locale, but every string already routes through `t()` so no UI
 * rewrite is needed then.
 */

import type { AdminLocale } from "./format";
export type { AdminLocale };

type Entry = Record<AdminLocale, string>;

const STRINGS = {
  app_title: { ar: "لوحة تحكم Fit Life", en: "Fit Life Admin" },
  // ── Admin auth (login screen) ──
  admin_login_title: { ar: "تسجيل دخول المشرف", en: "Admin sign in" },
  admin_login_subtitle: {
    ar: "هذه المنطقة مخصصة للمشرفين.",
    en: "This area is for administrators.",
  },
  field_password: { ar: "كلمة المرور", en: "Password" },
  action_sign_in: { ar: "دخول", en: "Sign in" },
  signing_in: { ar: "جارٍ الدخول…", en: "Signing in…" },
  login_error_credentials: {
    ar: "الإيميل أو كلمة المرور غير صحيحة.",
    en: "Incorrect email or password.",
  },
  login_error_unconfirmed: {
    ar: "لازم تأكدين إيميلك أولاً.",
    en: "Confirm your email first.",
  },
  login_error_generic: {
    ar: "حصل خطأ. حاولي مرة ثانية.",
    en: "Something went wrong. Try again.",
  },
  no_access_title: { ar: "لا صلاحية وصول", en: "No admin access" },
  no_access_body: {
    ar: "هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة.",
    en: "This account doesn’t have admin access.",
  },
  action_sign_out: { ar: "تسجيل الخروج", en: "Sign out" },

  nav_label: { ar: "التنقل", en: "Navigation" },
  nav_overview: { ar: "نظرة عامة", en: "Overview" },
  nav_insights: { ar: "التحليلات", en: "Insights" },
  signed_in_as: { ar: "مسجّل الدخول", en: "Signed in" },

  // ── Insights: trends ──
  insights_title: { ar: "التحليلات والصحة التشغيلية", en: "Insights & operational health" },
  section_trends: { ar: "الاتجاهات", en: "Trends" },
  chart_signups: { ar: "اشتراكات جديدة / شهر", en: "New signups / month" },
  chart_growth: { ar: "نمو المشتركين", en: "Subscriber growth" },
  chart_ai_cost: { ar: "تكلفة الذكاء / شهر", en: "AI cost / month" },
  chart_generations: { ar: "نجاح / فشل الإنشاء", en: "Generation success / failure" },
  chart_funnel: { ar: "مسار التحويل", en: "Conversion funnel" },
  funnel_signups: { ar: "التسجيل", en: "Signups" },
  funnel_onboarded: { ar: "أكمل الإعداد", en: "Onboarded" },
  funnel_first_plan: { ar: "أول خطة", en: "First plan" },
  stat_cost_per_plan: { ar: "التكلفة لكل خطة", en: "Cost per plan" },
  stat_cost_per_user: { ar: "التكلفة لكل مستخدم نشط", en: "Cost per active user" },
  stat_total_ai: { ar: "إجمالي تكلفة الذكاء", en: "Total AI cost" },

  // ── Insights: operational health ──
  section_ops: { ar: "الصحة التشغيلية", en: "Operational health" },
  ops_failures: { ar: "إنشاءات فاشلة", en: "Generation failures" },
  ops_medical: { ar: "محجوبون ببوابة طبية", en: "Medical-gate blocks" },
  ops_chat_cap: { ar: "بلغوا حد المحادثة اليوم", en: "Hit chat cap today" },
  ops_billing: { ar: "تنبيهات الفوترة", en: "Billing anomalies" },
  ops_none: { ar: "لا يوجد", en: "None" },
  ops_and_more: { ar: "والمزيد", en: "and more" },
  col_when: { ar: "متى", en: "When" },
  col_error: { ar: "الخطأ", en: "Error" },
  action_view: { ar: "عرض", en: "View" },

  loading_label: { ar: "جارٍ تحميل لوحة الإدارة", en: "Loading admin dashboard" },
  kpi_strip_label: { ar: "مؤشرات الأداء الرئيسية", en: "Key metrics" },
  trend_up: { ar: "ارتفاع", en: "up" },
  trend_down: { ar: "انخفاض", en: "down" },
  trend_flat: { ar: "ثابت", en: "flat" },
  nav_pagination: { ar: "التنقل بين الصفحات", en: "Pagination" },
  page_label: { ar: "صفحة", en: "Page" },
  failed_plans: { ar: "خطط فاشلة", en: "failed plans" },

  period_label: { ar: "الفترة", en: "Period" },
  period_30: { ar: "آخر ٣٠ يوم", en: "Last 30 days" },
  period_90: { ar: "آخر ٩٠ يوم", en: "Last 90 days" },
  vs_prior: { ar: "مقابل الفترة السابقة", en: "vs prior period" },

  // KPI labels
  kpi_subscribers: { ar: "المشتركون", en: "Subscribers" },
  kpi_active: { ar: "نشط", en: "active" },
  kpi_trialing: { ar: "تجريبي", en: "trial" },
  kpi_mrr: { ar: "الإيراد الشهري", en: "MRR" },
  kpi_arr: { ar: "سنوي", en: "ARR" },
  kpi_new_signups: { ar: "اشتراكات جديدة", en: "New signups" },
  kpi_conversion: { ar: "تحويل التجربة", en: "Trial → paid" },
  kpi_churn: { ar: "الإلغاءات", en: "Churn" },
  kpi_churn_rate: { ar: "نسبة الإلغاء", en: "churn rate" },
  kpi_plans: { ar: "خطط مُنشأة", en: "Plans generated" },
  kpi_ai_spend: { ar: "تكلفة الذكاء الاصطناعي", en: "AI spend" },
  kpi_of_revenue: { ar: "من الإيراد", en: "of revenue" },
  kpi_avg_household: { ar: "متوسط حجم الأسرة", en: "Avg household" },
  kpi_beneficiaries: { ar: "مستفيد", en: "beneficiaries" },

  // Subscriber table
  table_title: { ar: "كل المشتركين", en: "All subscribers" },
  search_placeholder: { ar: "بحث بالاسم أو البريد", en: "Search name or email" },
  filter_all: { ar: "الكل", en: "All" },
  filter_tier: { ar: "الباقة", en: "Tier" },
  filter_status: { ar: "الحالة", en: "Status" },
  col_name: { ar: "المشترك", en: "Subscriber" },
  col_tier: { ar: "الباقة", en: "Tier" },
  col_status: { ar: "الحالة", en: "Status" },
  col_signup: { ar: "التسجيل", en: "Signup" },
  col_renewal: { ar: "التجديد / التجربة", en: "Renewal / trial" },
  col_household: { ar: "الأسرة", en: "Household" },
  col_plans: { ar: "الخطط", en: "Plans" },
  col_activity: { ar: "آخر نشاط", en: "Last activity" },
  col_ai_cost: { ar: "تكلفة الذكاء", en: "AI cost" },
  table_empty: { ar: "لا يوجد مشتركون بعد", en: "No subscribers yet" },
  table_no_match: { ar: "لا نتائج مطابقة للتصفية", en: "No subscribers match the filters" },
  results_count: { ar: "مشترك", en: "subscribers" },

  // Pagination
  page_prev: { ar: "السابق", en: "Previous" },
  page_next: { ar: "التالي", en: "Next" },

  // Status labels
  status_trialing: { ar: "تجريبي", en: "Trialing" },
  status_active: { ar: "نشط", en: "Active" },
  status_past_due: { ar: "متأخر الدفع", en: "Past due" },
  status_cancelled: { ar: "ملغى", en: "Cancelled" },
  status_expired: { ar: "منتهي", en: "Expired" },
  status_none: { ar: "بدون اشتراك", en: "No subscription" },

  // Flags / misc
  flag_over_limit: { ar: "تجاوز الحد", en: "Over limit" },
  flag_housekeeper: { ar: "خادمة", en: "Housekeeper" },
  flag_onboarding_incomplete: { ar: "لم يكمل التسجيل", en: "Onboarding incomplete" },
  cancel_scheduled: { ar: "إلغاء مجدول", en: "Cancel scheduled" },

  // ── Subscriber detail ──
  back_to_overview: { ar: "العودة إلى اللوحة", en: "Back to dashboard" },
  back_to_subscriber: { ar: "العودة إلى المشترك", en: "Back to subscriber" },
  not_set: { ar: "غير محدد", en: "Not set" },
  yes: { ar: "نعم", en: "Yes" },
  no: { ar: "لا", en: "No" },
  none_listed: { ar: "لا شيء", en: "None" },

  section_account: { ar: "الحساب", en: "Account" },
  field_email: { ar: "البريد الإلكتروني", en: "Email" },
  field_locale: { ar: "اللغة", en: "Language" },
  field_signup: { ar: "تاريخ التسجيل", en: "Signup date" },
  field_onboarding: { ar: "حالة التسجيل", en: "Onboarding" },
  onboarding_complete: { ar: "مكتمل", en: "Complete" },
  field_family_wide: { ar: "تفضيلات الأسرة", en: "Family preferences" },
  field_mom_profile: { ar: "ملف الأم", en: "Mom profile" },

  section_subscription: { ar: "الاشتراك", en: "Subscription" },
  field_cadence: { ar: "دورة الفوترة", en: "Billing cycle" },
  cadence_monthly: { ar: "شهري", en: "Monthly" },
  cadence_annual: { ar: "سنوي", en: "Annual" },
  field_trial: { ar: "التجربة", en: "Trial" },
  field_period_end: { ar: "نهاية الفترة", en: "Period ends" },
  field_ls_sub: { ar: "معرّف الاشتراك (LS)", en: "LS subscription ID" },
  field_ls_customer: { ar: "معرّف العميل (LS)", en: "LS customer ID" },
  field_ls_variant: { ar: "معرّف الباقة (LS)", en: "LS variant ID" },
  section_sub_history: { ar: "سجل الاشتراك", en: "Subscription history" },

  section_household: { ar: "الأسرة", en: "Household" },
  field_goal: { ar: "الهدف", en: "Goal" },
  field_calories: { ar: "السعرات", en: "Calories" },
  field_macros: { ar: "الماكروز", en: "Macros" },
  macro_protein: { ar: "بروتين", en: "Protein" },
  macro_carbs: { ar: "كارب", en: "Carbs" },
  macro_fat: { ar: "دهون", en: "Fat" },
  flag_picky: { ar: "صعب الإرضاء", en: "Picky eater" },
  flag_medical_gate: { ar: "بوابة طبية", en: "Medical gate" },
  view_health: { ar: "عرض التفاصيل الصحية (مُسجّل)", en: "View health detail (logged)" },

  section_plans: { ar: "الخطط الغذائية", en: "Meal plans" },
  field_days: { ar: "الأيام", en: "Days" },
  field_tokens: { ar: "التوكنز", en: "Tokens" },
  field_cost: { ar: "التكلفة", en: "Cost" },
  field_model: { ar: "النموذج", en: "Model" },
  inspect_plan: { ar: "فحص البيانات (مُسجّل)", en: "Inspect data (logged)" },
  no_plans: { ar: "لا توجد خطط", en: "No plans yet" },
  plan_generating: { ar: "قيد الإنشاء", en: "Generating" },
  plan_ready: { ar: "جاهزة", en: "Ready" },
  plan_failed: { ar: "فشلت", en: "Failed" },
  plan_archived: { ar: "مؤرشفة", en: "Archived" },

  section_generations: { ar: "سجل الإنشاء", en: "Generation history" },
  field_duration: { ar: "المدة", en: "Duration" },
  no_generations: { ar: "لا يوجد سجل", en: "No generation history" },
  gen_completed: { ar: "اكتملت", en: "Completed" },
  gen_failed: { ar: "فشلت", en: "Failed" },
  gen_started: { ar: "قيد التنفيذ", en: "Running" },

  section_engagement: { ar: "التفاعل", en: "Engagement" },
  field_chat_count: { ar: "رسائل المساعد", en: "Advisor messages" },
  field_chat_cost: { ar: "تكلفة المحادثة", en: "Chat cost" },

  section_flags: { ar: "التنبيهات", en: "Flags" },
  flag_medical_blocked: { ar: "محظور (بوابة طبية)", en: "Blocked (medical gate)" },
  flag_failed_gen: { ar: "إنشاءات فاشلة", en: "Failed generations" },
  flags_clear: { ar: "لا توجد تنبيهات", en: "No flags" },

  // ── Health detail (gated) ──
  health_title: { ar: "التفاصيل الصحية", en: "Health detail" },
  health_logged_note: {
    ar: "تم تسجيل هذا العرض في سجل التدقيق (PDPL).",
    en: "This view is recorded in the audit log (PDPL).",
  },
  field_pregnant: { ar: "حامل", en: "Pregnant" },
  field_trimester: { ar: "الثلث", en: "Trimester" },
  field_postpartum: { ar: "أشهر بعد الولادة", en: "Months postpartum" },
  field_high_risk: { ar: "حمل عالي الخطورة", en: "High-risk pregnancy" },
  field_consulted: { ar: "استشارة الطبيب", en: "Consulted doctor" },
  field_conditions: { ar: "الحالات الطبية", en: "Medical conditions" },
  field_allergies: { ar: "الحساسية", en: "Allergies" },
  field_dislikes: { ar: "ما لا تفضله", en: "Dislikes" },

  // ── Plan data inspect (gated) ──
  plan_data_title: { ar: "بيانات الخطة", en: "Plan data" },
  plan_data_logged_note: {
    ar: "تم تسجيل فحص بيانات الخطة في سجل التدقيق.",
    en: "Inspecting plan data is recorded in the audit log.",
  },

  // States
  retry: { ar: "إعادة المحاولة", en: "Try again" },
  error_title: { ar: "تعذّر تحميل البيانات", en: "Couldn’t load data" },
  error_body: {
    ar: "حدث خطأ أثناء جلب بيانات المشتركين. حدّث الصفحة للمحاولة مرة أخرى.",
    en: "Something went wrong loading subscriber data. Refresh to try again.",
  },
  truncated_warning: {
    ar: "بعض الإحصاءات قد تكون غير مكتملة (تم بلوغ حد التحميل).",
    en: "Some figures may be incomplete (load ceiling reached).",
  },
} as const satisfies Record<string, Entry>;

export type AdminStringKey = keyof typeof STRINGS;

export function t(key: AdminStringKey, locale: AdminLocale): string {
  return STRINGS[key][locale];
}

const TIER_EN: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  family: "Family",
  premium: "Premium",
};

/** Tier display name. Arabic uses the canonical pricing names; English a map. */
export function tierLabel(
  tier: string | null,
  locale: AdminLocale,
  arName: string | null,
): string {
  if (!tier) return "—";
  if (locale === "ar") return arName ?? tier;
  return TIER_EN[tier] ?? tier;
}

const STATUS_KEY: Record<string, AdminStringKey> = {
  trialing: "status_trialing",
  active: "status_active",
  past_due: "status_past_due",
  cancelled: "status_cancelled",
  expired: "status_expired",
};

export function statusLabel(status: string | null, locale: AdminLocale): string {
  if (!status) return t("status_none", locale);
  const key = STATUS_KEY[status];
  return key ? t(key, locale) : status;
}

const ROLE: Record<string, Entry> = {
  mom: { ar: "الأم", en: "Mom" },
  dad: { ar: "الأب", en: "Father" },
  son: { ar: "ابن", en: "Son" },
  daughter: { ar: "ابنة", en: "Daughter" },
  housekeeper: { ar: "الخادمة", en: "Housekeeper" },
  other_adult: { ar: "بالغ آخر", en: "Other adult" },
  other_child: { ar: "طفل آخر", en: "Other child" },
};
export function roleLabel(role: string, locale: AdminLocale): string {
  return ROLE[role]?.[locale] ?? role;
}

const GOAL: Record<string, Entry> = {
  fat_loss: { ar: "خسارة الدهون", en: "Fat loss" },
  muscle_gain: { ar: "بناء العضل", en: "Muscle gain" },
  body_recomposition: { ar: "إعادة التكوين", en: "Recomposition" },
  athletic_performance: { ar: "الأداء الرياضي", en: "Athletic performance" },
  metabolic_health: { ar: "الصحة الأيضية", en: "Metabolic health" },
  digestive_health: { ar: "الصحة الهضمية", en: "Digestive health" },
  pregnancy_lactation: { ar: "الحمل والرضاعة", en: "Pregnancy / lactation" },
  posture_recovery: { ar: "التعافي والقوام", en: "Posture / recovery" },
};
export function goalLabel(goal: string | null, locale: AdminLocale): string {
  if (!goal) return "—";
  return GOAL[goal]?.[locale] ?? goal;
}

export function cadenceLabel(cadence: string | null, locale: AdminLocale): string {
  if (cadence === "monthly") return t("cadence_monthly", locale);
  if (cadence === "annual") return t("cadence_annual", locale);
  return "—";
}

const PLAN_STATUS: Record<string, AdminStringKey> = {
  generating: "plan_generating",
  ready: "plan_ready",
  failed: "plan_failed",
  archived: "plan_archived",
};
export function planStatusLabel(status: string, locale: AdminLocale): string {
  const key = PLAN_STATUS[status];
  return key ? t(key, locale) : status;
}

const GEN_STATUS: Record<string, AdminStringKey> = {
  completed: "gen_completed",
  failed: "gen_failed",
  started: "gen_started",
};
export function genStatusLabel(status: string, locale: AdminLocale): string {
  const key = GEN_STATUS[status];
  return key ? t(key, locale) : status;
}
