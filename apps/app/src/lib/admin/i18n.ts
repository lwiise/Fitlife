/**
 * Admin-only i18n dictionary (ar/en). Deliberately DECOUPLED from the consumer
 * 7-locale PlanStrings system — this is operator-facing only. Default is Arabic
 * to match the app; a later phase wires the toggle + persistence and resolves
 * the active locale, but every string already routes through `t()` so no UI
 * rewrite is needed then.
 */

import { SUPPORTED_LANGUAGES } from "@fitlife/config";
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
  no_members: { ar: "لا يوجد أفراد في الأسرة", en: "No household members" },
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
  inspect_plan: { ar: "عرض الخطة", en: "View plan" },
  no_plans: { ar: "لا توجد خطط", en: "No plans yet" },
  plan_generating: { ar: "قيد الإنشاء", en: "Generating" },
  plan_ready: { ar: "جاهزة", en: "Ready" },
  plan_failed: { ar: "فشلت", en: "Failed" },
  plan_archived: { ar: "مؤرشفة", en: "Archived" },

  section_generations: { ar: "سجل الإنشاء", en: "Generation history" },
  field_duration: { ar: "المدة", en: "Duration" },
  no_generations: { ar: "لا يوجد سجل", en: "No generation history" },
  field_error: { ar: "الخطأ", en: "Error" },
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

  // ── Plan view (gated) ──
  plan_data_title: { ar: "الخطة", en: "Plan" },
  plan_data_logged_note: {
    ar: "تم تسجيل عرض خطة المشترك في سجل التدقيق.",
    en: "Viewing the subscriber's plan is recorded in the audit log.",
  },
  plan_no_data: {
    ar: "لا توجد خطة بعد (لم تُنشأ أو فشلت).",
    en: "No plan content yet (not generated or failed).",
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

  // ── v2: founder-question sections ──
  section_growth: { ar: "هل ننمو؟", en: "Are we growing?" },
  section_retention: { ar: "هل نحافظ على العملاء؟", en: "Are we keeping customers?" },
  section_conversion: { ar: "هل نحوّل؟", en: "Are we converting?" },
  section_economics: { ar: "كم نربح من كل عميل؟", en: "Are we earning per customer?" },
  section_product: { ar: "هل المنتج يؤدي دوره؟", en: "Is the product delivering?" },
  section_action_queue: { ar: "ماذا نفعل الآن؟", en: "What to act on now" },

  // ── v2: hero / KPI additions ──
  kpi_nrr: { ar: "صافي الاحتفاظ بالإيراد", en: "Net revenue retention" },
  kpi_arpu: { ar: "الإيراد لكل مستخدم", en: "ARPU" },
  kpi_gross_margin: { ar: "هامش الربح الإجمالي", en: "Gross margin" },
  kpi_net_new_mrr: { ar: "صافي الإيراد الجديد", en: "Net new MRR" },
  kpi_revenue_at_risk: { ar: "إيراد معرّض للخطر", en: "Revenue at risk" },
  mrr_new: { ar: "جديد", en: "New" },
  mrr_churned: { ar: "ملغى", en: "Churned" },
  mrr_net: { ar: "الصافي", en: "Net" },
  per_active_user: { ar: "لكل مستخدم نشط", en: "per active user" },
  est_label: { ar: "تقديري", en: "est." },
  net_revenue_churn: { ar: "صافي إلغاء الإيراد", en: "Net revenue churn" },
  gross_churn: { ar: "نسبة الإلغاء", en: "Gross churn" },

  // ── v2: chart titles ──
  chart_mrr_movement: { ar: "حركة الإيراد الشهري", en: "MRR movement" },
  chart_churn: { ar: "نسبة الإلغاء عبر الزمن", en: "Churn over time" },
  chart_cohort: { ar: "احتفاظ الأفواج", en: "Cohort retention" },
  chart_revenue_by_tier: { ar: "الإيراد حسب الباقة", en: "Revenue by tier" },
  chart_success_rate: { ar: "نسبة نجاح الإنشاء", en: "Generation success rate" },
  chart_failures_by_cause: { ar: "الإخفاقات حسب السبب", en: "Failures by cause" },
  chart_locale_users: { ar: "لغات المستخدمات", en: "User languages" },
  chart_locale_cooks: { ar: "لغات الطباخة", en: "Cook languages" },
  chart_engagement: { ar: "التفاعل النشِط", en: "Active engagement" },
  chart_plan_freshness: { ar: "حداثة الخطط", en: "Plan freshness" },

  // ── v2: conversion section ──
  conv_activation: { ar: "نسبة التفعيل", en: "Activation rate" },
  conv_activation_hint: {
    ar: "أكملوا الإعداد وأنشأوا أول خطة",
    en: "Completed onboarding and generated a first plan",
  },
  conv_trials_expiring: { ar: "تجارب تنتهي قريبًا", en: "Trials expiring soon" },
  trials_next_7: { ar: "خلال ٧ أيام", en: "Next 7 days" },
  trials_next_14: { ar: "خلال ١٤ يوم", en: "Next 14 days" },
  col_trial_ends: { ar: "تنتهي التجربة", en: "Trial ends" },
  col_days_left: { ar: "المتبقي", en: "Days left" },
  col_plan_yn: { ar: "خطة؟", en: "Plan?" },
  col_mrr: { ar: "الإيراد", en: "MRR" },
  col_renewal_short: { ar: "التجديد", en: "Renews" },
  days_unit: { ar: "يوم", en: "d" },

  // ── v2: retention section ──
  ret_quiet_paying: { ar: "حسابات مدفوعة هادئة قرب التجديد", en: "Quiet paying accounts near renewal" },
  cohort_month: { ar: "شهر التسجيل", en: "Signup month" },
  cohort_size: { ar: "الحجم", en: "Size" },
  cohort_age: { ar: "أشهر منذ التسجيل", en: "Months since signup" },

  // ── v2: economics section ──
  econ_assumptions: { ar: "الافتراضات", en: "Assumptions" },
  assume_ls_fee: { ar: "رسوم LemonSqueezy", en: "LemonSqueezy fee" },
  assume_infra: { ar: "البنية التحتية لكل مستخدم/شهر", en: "Infra per user / mo" },
  econ_revenue: { ar: "الإيراد", en: "Revenue" },
  econ_gross_profit: { ar: "الربح الإجمالي", en: "Gross profit" },
  econ_ai_cost: { ar: "تكلفة الذكاء", en: "AI cost" },
  econ_infra: { ar: "البنية التحتية", en: "Infra" },
  econ_fees: { ar: "الرسوم", en: "Fees" },
  potential_label: { ar: "محتمل (تجارب)", en: "Potential (trials)" },
  at_risk_label: { ar: "متعثّر (دفع متأخر)", en: "At risk (past-due)" },
  ltv_cac_placeholder: {
    ar: "LTV‏:‏CAC ووقت الاسترداد — يحتاج بيانات إنفاق الاستحواذ.",
    en: "LTV:CAC & payback — needs acquisition spend data.",
  },

  // ── v2: product / engagement ──
  engagement_7d: { ar: "نشط خلال ٧ أيام", en: "Active in 7 days" },
  engagement_30d: { ar: "نشط خلال ٣٠ يوم", en: "Active in 30 days" },
  freshness_hint: { ar: "أسر نشطة بخطة حديثة", en: "Active households with a recent plan" },

  // ── v2: action queue ──
  aq_trial_expiring: { ar: "تجربة تنتهي", en: "Trial expiring" },
  aq_past_due: { ar: "دفع متأخر", en: "Past due" },
  aq_quiet_high_value: { ar: "حساب مدفوع هادئ", en: "Quiet paying account" },
  aq_systemic_failures: { ar: "إخفاقات منهجية", en: "Systemic failures" },
  aq_empty: { ar: "لا شيء يحتاج تدخلًا الآن", en: "Nothing needs attention right now" },
  severity_high: { ar: "عاجل", en: "High" },
  severity_medium: { ar: "متوسط", en: "Medium" },
  severity_low: { ar: "منخفض", en: "Low" },

  // ── v2: failure causes ──
  failure_max_tokens: { ar: "حجم كبير / تجاوز التوكنز", en: "Too large / max tokens" },
  failure_timeout: { ar: "انتهاء المهلة", en: "Timeout" },
  failure_rate_limit: { ar: "تجاوز حد المعدل", en: "Rate limit" },
  failure_validation: { ar: "تحقّق غير صالح", en: "Validation" },
  failure_api_error: { ar: "خطأ في الواجهة", en: "API error" },
  failure_unknown: { ar: "غير معروف", en: "Unknown" },

  // ── v2: approximation / state notes ──
  approx_snapshot: {
    ar: "تقريبي من اللقطة الحالية — لا يتوفر سجل حالات.",
    en: "Approximate — from the current snapshot (no status-history table).",
  },
  approx_no_expansion: {
    ar: "بدون سجل ترقية/تخفيض الباقات، لا يُحتسب التوسّع أو الانكماش.",
    en: "No upgrade/downgrade history — expansion/contraction aren’t counted.",
  },
  approx_cohort: {
    ar: "مثلّث لقطة حالية وليس احتفاظًا تاريخيًا — يتحسّن مع تراكم البيانات.",
    en: "Current-snapshot triangle, not historical retention — sharpens as history accrues.",
  },
  approx_freshness: {
    ar: "تقريبي — لا نحمّل محتوى الخطة كاملًا.",
    en: "Approximate — full plan content isn’t loaded.",
  },
  approx_nrr: {
    ar: "تقريبي — يساوي ١٠٠٪ ناقص صافي إلغاء الإيراد.",
    en: "Approximate — equals 100% minus net revenue churn.",
  },
  est_note: {
    ar: "أرقام تقديرية بافتراضات رسوم وبنية تحتية.",
    en: "Estimated using assumed fees and infra.",
  },
  chart_empty: { ar: "لا توجد بيانات بعد", en: "No data yet" },
  chart_error: { ar: "تعذّر عرض الرسم", en: "Couldn’t render this chart" },

  // ── Overview: revenue & subscriptions chart ──
  chart_revenue_subscriptions: {
    ar: "الإيراد والاشتراكات حسب الباقة",
    en: "Revenue & subscriptions by tier",
  },
  metric_label: { ar: "المقياس", en: "Metric" },
  metric_revenue: { ar: "الإيراد", en: "Revenue" },
  metric_subscriptions: { ar: "الاشتراكات", en: "Subscriptions" },
  range_week: { ar: "هذا الأسبوع", en: "This week" },
  range_month: { ar: "هذا الشهر", en: "This month" },
  range_custom: { ar: "مخصص", en: "Custom" },
  date_from: { ar: "من", en: "From" },
  date_to: { ar: "إلى", en: "To" },
  range_apply: { ar: "تطبيق", en: "Apply" },
  col_total: { ar: "الإجمالي", en: "Total" },

  // ── Overview: AI cost strip ──
  ai_cost_per_account: { ar: "تكلفة الذكاء لكل حساب", en: "AI cost per account" },
  ai_cost_per_member: { ar: "تكلفة الذكاء لكل مستفيد", en: "AI cost per beneficiary" },
  ai_cost_per_plan: { ar: "تكلفة الذكاء لكل خطة", en: "AI cost per plan" },
  ai_cost_per_member_plan: { ar: "تكلفة الذكاء لكل فرد في الخطة", en: "AI cost per member plan" },
  kpi_active_users: { ar: "المستخدمون النشطون", en: "Active users" },
  per_account: { ar: "لكل حساب", en: "per account" },
  per_beneficiary: { ar: "لكل مستفيد", en: "per beneficiary" },
  per_plan: { ar: "لكل خطة", en: "per plan" },
  per_member_plan: { ar: "لكل فرد في خطة", en: "per member plan" },
  ai_avg_active_note: {
    ar: "المتوسطات محسوبة على الحسابات التي استخدمت الذكاء في الفترة.",
    en: "Averages cover only accounts that used AI in the period.",
  },
  cost_efficiency: { ar: "التكلفة والكفاءة", en: "Cost & efficiency" },
  ai_billed_usd_note: {
    ar: "تُحتسب تكلفة الذكاء بالدولار وتُعرض بالريال وفق سعر الصرف المعتمد.",
    en: "AI is billed in USD; shown in SAR at the platform rate.",
  },

  // ── Overview: subscribers table legend / affordances ──
  table_legend_label: { ar: "دليل الرموز", en: "Legend" },
  view_subscriber: { ar: "تفاصيل المشترك", en: "View subscriber" },
  info_more: { ar: "تفاصيل إضافية", en: "More info" },

  // ── Overview: Kajabi-style chart controls ──
  range_24h: { ar: "آخر ٢٤ ساعة", en: "Last 24h" },
  range_7d: { ar: "آخر ٧ أيام", en: "Last 7 days" },
  interval_label: { ar: "التقسيم الزمني", en: "Group by" },
  interval_hour: { ar: "ساعة", en: "Hour" },
  interval_day: { ar: "يوم", en: "Day" },
  interval_week: { ar: "أسبوع", en: "Week" },
  interval_month: { ar: "شهر", en: "Month" },
  legend_current: { ar: "الحالية", en: "Current" },
  customize_metrics: { ar: "تخصيص المؤشرات", en: "Customize metrics" },
  currency_label: { ar: "ر.س", en: "SAR" },
  currency_usd_label: { ar: "دولار", en: "USD" },
  currency_group_label: { ar: "عملة التكلفة", en: "Cost currency" },

  // ── Overview: metric labels ──
  metric_gross_revenue: { ar: "إجمالي الإيراد", en: "Gross revenue" },
  metric_active_subs: { ar: "المشتركون النشطون", en: "Active subscribers" },
  metric_trials: { ar: "التجارب", en: "Trials" },
  metric_churned: { ar: "الإلغاءات", en: "Churned" },
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

const FAILURE_KEY: Record<string, AdminStringKey> = {
  max_tokens: "failure_max_tokens",
  timeout: "failure_timeout",
  rate_limit: "failure_rate_limit",
  validation: "failure_validation",
  api_error: "failure_api_error",
  unknown: "failure_unknown",
};
export function failureCauseLabel(cause: string, locale: AdminLocale): string {
  const key = FAILURE_KEY[cause];
  return key ? t(key, locale) : cause;
}

const LANG_NAME = new Map<string, string>(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.name]),
);
/** Native language name for a locale code (e.g. "العربية", "Tagalog"). */
export function localeName(code: string): string {
  return LANG_NAME.get(code) ?? code;
}

const METRIC_KEY: Record<string, AdminStringKey> = {
  gross_revenue: "metric_gross_revenue",
  mrr: "kpi_mrr",
  active_subs: "metric_active_subs",
  new_signups: "kpi_new_signups",
  trials: "metric_trials",
  churned: "metric_churned",
};
export function metricLabel(metric: string, locale: AdminLocale): string {
  const key = METRIC_KEY[metric];
  return key ? t(key, locale) : metric;
}

const INTERVAL_KEY: Record<string, AdminStringKey> = {
  hour: "interval_hour",
  day: "interval_day",
  week: "interval_week",
  month: "interval_month",
};
export function intervalLabel(interval: string, locale: AdminLocale): string {
  const key = INTERVAL_KEY[interval];
  return key ? t(key, locale) : interval;
}
