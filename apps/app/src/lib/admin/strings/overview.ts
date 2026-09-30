import type { Entry } from "./types";

/**
 * Admin strings for the overview — metric tiles, range controls, chart, cost and engagement tiles.
 * Every key starts with `ov_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 *
 * Arabic is written first and in فصحى, addressed to the operator without any
 * gendered imperative. Meanings that already exist in i18n.ts are reused from
 * there (nav_overview, range_24h, range_7d, period_30, period_90, range_custom,
 * period_label, interval_label, date_from, date_to, range_apply,
 * customize_metrics, kpi_strip_label, trend_up/down/flat, vs_prior,
 * cost_efficiency, stat_total_ai, ai_cost_per_*, approx_snapshot,
 * truncated_warning, table_empty). `{name}` placeholders are filled by the
 * overview model with already-formatted values.
 */
export const OVERVIEW_STRINGS = {
  // ── Range controls ──
  ov_custom_title: { ar: "نطاق مخصص", en: "Custom range" },
  ov_custom_active: { ar: "مخصص: {range}", en: "Custom: {range}" },
  ov_custom_invalid: {
    ar: "يلزم تحديد التاريخين، وأن يسبق تاريخ البداية تاريخ النهاية أو يساويه.",
    en: "Pick both dates, with the start on or before the end.",
  },
  ov_customize_cap: { ar: "حتى ٤ مؤشرات", en: "Up to 4 metrics" },
  ov_customize_full: {
    ar: "بلغ العدد الحد الأقصى، وهو ٤ مؤشرات. إضافة مؤشر آخر تتطلب إلغاء واحد منها.",
    en: "That is the maximum of 4. Remove one to add another.",
  },
  ov_customize_min: {
    ar: "يبقى مؤشر واحد على الأقل ظاهراً.",
    en: "At least one metric stays shown.",
  },
  ov_updating: { ar: "جارٍ تحديث الأرقام…", en: "Updating the figures…" },

  // ── Metric tiles ──
  // {dir} = ارتفاع/انخفاض/ثابت, {pct} = the change, {prior} = the prior value.
  ov_delta_sr: {
    ar: "{dir} {pct} مقابل الفترة السابقة ({prior})",
    en: "{dir} {pct} vs the prior period ({prior})",
  },
  ov_from_zero: { ar: "من الصفر", en: "from zero" },
  // Under a tile's change: the prior period's value. {prior} is formatted.
  ov_vs_value: { ar: "مقابل {prior}", en: "vs {prior}" },

  // ── Chart ──
  ov_running_total: { ar: "تراكمي خلال الفترة", en: "Running total over the period" },
  ov_level_end_hour: { ar: "المستوى في نهاية كل ساعة", en: "Level at the end of each hour" },
  ov_level_end_day: { ar: "المستوى في نهاية كل يوم", en: "Level at the end of each day" },
  ov_level_end_week: { ar: "المستوى في نهاية كل أسبوع", en: "Level at the end of each week" },
  ov_level_end_month: { ar: "المستوى في نهاية كل شهر", en: "Level at the end of each month" },
  ov_cur_period: { ar: "الفترة الحالية", en: "This period" },
  ov_prior_period: { ar: "الفترة السابقة", en: "Prior period" },
  ov_as_table: { ar: "عرض كجدول", en: "Show as table" },
  ov_as_chart: { ar: "عرض كرسم", en: "Show as chart" },
  ov_col_date: { ar: "التاريخ", en: "Date" },
  ov_week_of: { ar: "أسبوع {date}", en: "Week of {date}" },
  // A flow's own amount in one bucket (the chart plots its running total).
  ov_step_hour: { ar: "خلال الساعة", en: "That hour" },
  ov_step_day: { ar: "خلال اليوم", en: "That day" },
  ov_step_week: { ar: "خلال الأسبوع", en: "That week" },
  ov_step_month: { ar: "خلال الشهر", en: "That month" },
  ov_chart_role: { ar: "رسم بياني", en: "chart" },
  ov_chart_keys: {
    ar: "مفاتيح الأسهم تنقل بين النقاط، ومفتاحا Home وEnd ينقلان إلى أول نقطة وآخرها.",
    en: "Arrow keys move between points; Home and End jump to the first and the last.",
  },
  ov_chart_empty: { ar: "لا توجد قيم في هذه الفترة", en: "Nothing recorded in this period" },
  // Spoken when a point is reached with the keyboard. {values} is the
  // tooltip's «label value» rows, joined by ov_sr_sep.
  ov_point_sr: { ar: "{date}: {values}", en: "{date}: {values}" },
  ov_sr_sep: { ar: "، ", en: ", " },

  // ── AI cost ──
  ov_hint_per_account: {
    ar: "الحسابات التي استخدمت الذكاء: {n}",
    en: "Accounts that used AI: {n}",
  },
  ov_hint_per_member: {
    ar: "على المستفيدين في تلك الحسابات",
    en: "Across those accounts’ beneficiaries",
  },
  ov_hint_per_plan: {
    ar: "إنشاء الخطط وحده، دون المحادثة",
    en: "Plan generation only, chat excluded",
  },
  ov_hint_per_member_plan: {
    ar: "لكل فرد في كل خطة",
    en: "Each person on each plan",
  },
  ov_cost_pct: { ar: "{pct} من الإيراد (تقديري)", en: "{pct} of revenue (est.)" },
  ov_cost_note_avg: {
    ar: "المتوسطات على الحسابات التي استخدمت الذكاء في الفترة",
    en: "Averages cover the accounts that used AI in the period",
  },
  ov_cost_note_sar: {
    ar: "تُحتسب بالدولار وتُعرض بالريال وفق سعر الصرف المعتمد",
    en: "Billed in USD, shown in SAR at the platform rate",
  },
  ov_cost_note_usd: { ar: "تُحتسب بالدولار", en: "Billed in USD" },

  // ── Engagement ──
  ov_engage_title: { ar: "طبقة التفاعل", en: "Engagement layer" },
  ov_e_checkins: { ar: "تسجيلات الوجبات (٧ أيام)", en: "Meal check-ins (7d)" },
  ov_e_households: { ar: "بيوت نشطة التسجيل (٧ أيام)", en: "Active households (7d)" },
  ov_e_verdicts: { ar: "آراء الأطباق (٧ أيام)", en: "Dish verdicts (7d)" },
  ov_e_weighins: { ar: "تسجيلات وزن (٧ أيام)", en: "Weigh-ins (7d)" },
  ov_e_changes: { ar: "خطط فيها «سارة عدّلت»", en: "Plans with week changes" },
  ov_e_changes_h: { ar: "من آخر ٢٥ خطة", en: "Of the last 25 plans" },
  ov_e_renewal: { ar: "مدفوع تجاوز أول تجديد", en: "Paid past the first renewal" },
  ov_e_renewal_h: {
    ar: "مؤشر تقريبي، وهو المقياس الرئيسي للطبقة",
    en: "A proxy — the layer’s headline metric",
  },
  // {code} is the migration number, rendered as an isolated left-to-right code.
  ov_e_missing: {
    ar: "الجداول غير مفعّلة — يلزم تطبيق {code}",
    en: "Tables not enabled — migration {code} is needed",
  },
  ov_e_unavailable: {
    ar: "تعذّر تحميل أرقام التفاعل الآن.",
    en: "The engagement figures couldn’t be loaded right now.",
  },

  // ── Page states ──
  ov_empty_body: {
    ar: "تظهر المؤشرات هنا بعد أول تسجيل.",
    en: "Metrics appear here after the first signup.",
  },
  ov_loading: { ar: "جارٍ تحميل نظرة عامة…", en: "Loading the overview…" },
} as const satisfies Record<string, Entry>;
