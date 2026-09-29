import type { Entry } from "./types";

/**
 * Admin strings for the full family page and its tabs (meal, exercise, household, billing, runs, account).
 * Every key starts with `fm_` so the merged dictionary in ../i18n.ts can
 * never collide with another module's keys.
 *
 * Arabic is written first, in فصحى, operator-facing and without gendered dual
 * forms. `{name}`-style placeholders are filled by `fill()` in
 * app/admin/_blocks/helpers.ts with already-formatted values. Plural families
 * (`fm_n_*_{zero,one,two,few,many,other}`) are picked with Intl.PluralRules;
 * English only ever reaches `_one` and `_other`.
 *
 * Meanings that already exist in ../i18n.ts are reused from there (field_*,
 * section_*, plan_*, gen_*, flag_*, status_*, yes/no, not_set, no_members…).
 */
export const FAMILY_STRINGS = {
  // ── Shared words ──
  fm_of: { ar: "من", en: "of" },
  fm_kcal: { ar: "سعرة", en: "kcal" },
  fm_protein: { ar: "بروتين", en: "Protein" },
  fm_g: { ar: "غ", en: "g" },
  fm_today: { ar: "اليوم", en: "Today" },
  fm_close: { ar: "إغلاق", en: "Close" },
  fm_approx: { ar: "تقريبي", en: "approx." },
  // " في {date}" — appended to a sentence that may or may not have a date.
  fm_on_date: { ar: " في {date}", en: " on {date}" },
  fm_day_n: { ar: "اليوم {n}", en: "Day {n}" },
  fm_minutes_range: { ar: "{from}–{to} دقيقة", en: "{from}–{to} min" },

  fm_n_people_zero: { ar: "لا أحد", en: "{n} people" },
  fm_n_people_one: { ar: "فرد واحد", en: "{n} person" },
  fm_n_people_two: { ar: "فردان", en: "{n} people" },
  fm_n_people_few: { ar: "{n} أفراد", en: "{n} people" },
  fm_n_people_many: { ar: "{n} فرداً", en: "{n} people" },
  fm_n_people_other: { ar: "{n} فرد", en: "{n} people" },

  fm_n_min_zero: { ar: "{n} دقيقة", en: "{n} min" },
  fm_n_min_one: { ar: "دقيقة واحدة", en: "{n} min" },
  fm_n_min_two: { ar: "دقيقتان", en: "{n} min" },
  fm_n_min_few: { ar: "{n} دقائق", en: "{n} min" },
  fm_n_min_many: { ar: "{n} دقيقة", en: "{n} min" },
  fm_n_min_other: { ar: "{n} دقيقة", en: "{n} min" },

  // ── Plan states ──
  fm_state_none: { ar: "لا يوجد", en: "None" },
  fm_masked_short: {
    ar: "فشلت آخر محاولة، والسابقة ما زالت معروضة للعائلة",
    en: "The latest run failed; the family still sees the previous one",
  },
  fm_generated: { ar: "أُنشئت", en: "Generated" },
  fm_started: { ar: "بدأت", en: "Started" },
  fm_run_cost: { ar: "تكلفة الإنشاء", en: "Run cost" },

  // ── Meal plan: summary ──
  fm_days_ready: { ar: "أيام جاهزة", en: "days ready" },
  fm_people_on_plan: { ar: "أفراد في الخطة", en: "people on the plan" },
  fm_meal_none: { ar: "لا توجد خطة غذائية بعد", en: "No meal plan yet" },
  fm_meal_none_b: {
    ar: "تظهر هنا بعد أول عملية إنشاء.",
    en: "It appears here after the first generation run.",
  },
  fm_meal_masked: {
    ar: "فشلت آخر محاولة لإنشاء الخطة{when}، والخطة السابقة ما زالت معروضة للعائلة.",
    en: "The latest meal plan run{when} failed; the family still sees the previous plan.",
  },
  fm_meal_failed: {
    ar: "فشل إنشاء الخطة{when}، ولا توجد خطة سابقة تُعرض للعائلة.",
    en: "The meal plan run{when} failed, and there is no earlier plan to show the family.",
  },

  // ── Meal plan: the week ──
  fm_slot_breakfast: { ar: "فطور", en: "Breakfast" },
  fm_slot_lunch: { ar: "غداء", en: "Lunch" },
  fm_slot_snack: { ar: "وجبة خفيفة", en: "Snack" },
  fm_slot_dinner: { ar: "عشاء", en: "Dinner" },
  fm_shared: { ar: "مشتركة", en: "Shared" },
  fm_day_total: { ar: "مجموع اليوم", en: "Day total" },
  fm_portions: { ar: "بالحصص، بدون هدف سعرات", en: "By portions, no calorie target" },
  fm_portions_short: { ar: "بالحصص", en: "portions" },
  fm_child: { ar: "طفل", en: "child" },
  fm_members_label: { ar: "أفراد الخطة", en: "People on the plan" },
  fm_days_label: { ar: "أيام الخطة", en: "Days of the plan" },
  fm_day_not_ready: { ar: "لم يُنشأ بعد", en: "not generated yet" },
  fm_day_missing: { ar: "لم يُنشأ هذا اليوم بعد", en: "This day hasn’t been generated yet" },
  fm_day_missing_b: {
    ar: "يُستكمل عادةً في عملية إنشاء لاحقة.",
    en: "A later run usually fills it in.",
  },
  fm_day_generating: { ar: "يُنشأ هذا اليوم الآن", en: "This day is being generated" },
  fm_day_generating_b: {
    ar: "يظهر هنا فور اكتماله.",
    en: "It appears here as soon as it’s done.",
  },
  fm_week_empty: { ar: "لا يمكن عرض أيام هذه الخطة", en: "This plan’s days can’t be shown" },
  fm_week_empty_b: {
    ar: "لم تُحفظ فيها وجبات بعد، أو تعذّرت قراءتها.",
    en: "No meals were saved in it yet, or it couldn’t be read.",
  },

  // ── Plan history (meal + exercise) ──
  fm_earlier_plans: { ar: "الخطط السابقة", en: "Earlier plans" },
  fm_all_plans: { ar: "كل الخطط", en: "All plans" },
  fm_open_plan: { ar: "فتح الخطة", en: "Open plan" },
  fm_col_date: { ar: "التاريخ", en: "Date" },
  fm_tokens_head: { ar: "التوكنز (داخل / خارج)", en: "Tokens (in / out)" },

  // ── Exercise program: summary ──
  fm_program: { ar: "البرنامج الحالي", en: "Current program" },
  fm_trainees: { ar: "متدرّبون", en: "trainees" },
  fm_sessions_wk: { ar: "حصص أسبوعياً", en: "sessions a week" },
  fm_ex_none: {
    ar: "لم تشترك الأسرة في خطة التمارين",
    en: "This household hasn’t opted into exercise plans",
  },
  fm_ex_none_b: {
    ar: "تظهر الخطة هنا عند الاشتراك من صفحة العميل.",
    en: "It appears here once they opt in from their account.",
  },
  fm_ex_no_program: {
    ar: "أجابت الأسرة عن أسئلة التمارين، ولم يُنشأ برنامج بعد",
    en: "The household answered the exercise questions; no program yet",
  },
  fm_ex_no_program_b: {
    ar: "يظهر البرنامج هنا بعد أول عملية إنشاء.",
    en: "The program appears here after the first generation run.",
  },
  fm_ex_waiting: { ar: "ينتظر اكتمال الوجبات", en: "Waiting for the meal plan to finish" },
  fm_ex_waiting_b: {
    ar: "تبدأ التمارين بعد الوجبات حتى تأخذ الوجبات كامل الوقت.",
    en: "Exercise runs after meals so meals get the full time budget.",
  },
  fm_ex_generating: { ar: "يُنشأ البرنامج الآن", en: "The program is being generated" },
  fm_ex_generating_b: { ar: "بدأ الإنشاء في {date}.", en: "Started {date}." },
  fm_ex_masked: {
    ar: "فشلت آخر محاولة لإنشاء البرنامج{when}، والبرنامج السابق ما زال معروضاً للعائلة.",
    en: "The latest exercise run{when} failed; the family still sees the previous program.",
  },
  fm_ex_failed: {
    ar: "فشل إنشاء البرنامج{when}، ولا يوجد برنامج سابق يُعرض للعائلة.",
    en: "The exercise run{when} failed, and there is no earlier program to show the family.",
  },

  // ── Exercise program: trainees ──
  fm_done_week: { ar: "المنجز هذا الأسبوع", en: "Done this week" },
  fm_not_incl: { ar: "خارج خطط التمارين", en: "Not included in exercise plans" },
  fm_not_incl_why: {
    ar: "الأطفال والطبّاخة لا تُنشأ لهم برامج تمارين.",
    en: "Children and the cook never get exercise programs.",
  },
  fm_not_incl_short: { ar: "خارج التمارين", en: "not included" },
  fm_no_answers: { ar: "إجابات أسئلة التمارين غير متاحة", en: "Exercise answers unavailable" },
  fm_training_days: { ar: "أيام التدريب", en: "Training days" },
  fm_done_days: { ar: "المنجزة", en: "Done" },
  fm_trainees_label: { ar: "المتدرّبون", en: "Trainees" },
  fm_week_label: { ar: "أسبوع التدريب", en: "Training week" },
  fm_no_sessions: { ar: "لا توجد حصص في هذا البرنامج", en: "This program has no sessions" },

  fm_loc_home: { ar: "المنزل", en: "Home" },
  fm_loc_gym: { ar: "النادي", en: "Gym" },
  fm_loc_both: { ar: "المنزل والنادي", en: "Home and gym" },
  fm_eq_none: { ar: "بدون أدوات", en: "no equipment" },
  fm_eq_dumbbells: { ar: "دمبل", en: "dumbbells" },
  fm_eq_bands: { ar: "أحبال مقاومة", en: "resistance bands" },
  fm_eq_machines: {
    ar: "أجهزة منزلية (سير أو دراجة)",
    en: "home machines (treadmill or bike)",
  },
  fm_lvl_beginner_f: { ar: "مبتدئة", en: "Beginner" },
  fm_lvl_beginner_m: { ar: "مبتدئ", en: "Beginner" },
  fm_lvl_intermediate_f: { ar: "متوسطة", en: "Intermediate" },
  fm_lvl_intermediate_m: { ar: "متوسط", en: "Intermediate" },
  fm_lvl_advanced_f: { ar: "متقدمة", en: "Advanced" },
  fm_lvl_advanced_m: { ar: "متقدم", en: "Advanced" },
  fm_focus_full_body: { ar: "الجسم كامل", en: "Full body" },
  fm_focus_core: { ar: "البطن والكور", en: "Core" },
  fm_focus_lower_glutes: { ar: "الأرجل والمؤخرة", en: "Legs and glutes" },
  fm_focus_strength: { ar: "القوة العامة", en: "General strength" },
  fm_focus_endurance: { ar: "اللياقة والتحمل", en: "Fitness and endurance" },
  fm_focus_definition: { ar: "إبراز التفاصيل العضلية", en: "Muscle definition" },
  fm_focus_balanced: { ar: "برنامج متوازن", en: "Balanced program" },

  fm_place: { ar: "المكان", en: "Location" },
  fm_equipment: { ar: "الأدوات", en: "Equipment" },
  fm_level: { ar: "المستوى", en: "Level" },
  fm_focus: { ar: "التركيز", en: "Focus" },
  fm_session_length: { ar: "مدة الحصة", en: "Session length" },
  fm_chosen_days: { ar: "الأيام المختارة", en: "Chosen days" },
  fm_split: { ar: "التقسيم", en: "Split" },

  // ── Exercise program: the week and one session ──
  fm_rest_day: { ar: "راحة", en: "Rest" },
  fm_rest_s: { ar: "راحة {n} ث", en: "rest {n}s" },
  fm_warmup: { ar: "الإحماء", en: "Warm-up" },
  fm_cooldown: { ar: "التهدئة", en: "Cool-down" },
  fm_progression: { ar: "التدرّج", en: "Progression" },
  fm_home_variant: { ar: "نسخة المنزل", en: "Home version" },
  fm_mark_done: { ar: "تمّت", en: "Done" },
  fm_mark_moved: { ar: "نُقلت", en: "Moved" },
  fm_mark_skipped: { ar: "فُوّتت", en: "Skipped" },
  fm_mark_none: { ar: "بلا تسجيل", en: "Not marked" },
  fm_upcoming: { ar: "قادمة", en: "Upcoming" },
  fm_intensity: { ar: "الشدة", en: "Intensity" },
  fm_int_easy: { ar: "سهلة", en: "easy" },
  fm_int_right: { ar: "مناسبة", en: "right" },
  fm_int_hard: { ar: "صعبة", en: "hard" },
  // One-letter weekday marks, 0 = Sunday … 6 = Saturday.
  fm_wdi_0: { ar: "ح", en: "S" },
  fm_wdi_1: { ar: "ن", en: "M" },
  fm_wdi_2: { ar: "ث", en: "T" },
  fm_wdi_3: { ar: "ر", en: "W" },
  fm_wdi_4: { ar: "خ", en: "T" },
  fm_wdi_5: { ar: "ج", en: "F" },
  fm_wdi_6: { ar: "س", en: "S" },

  fm_prog_history: { ar: "سجل البرامج", en: "Program history" },
  fm_open_program: { ar: "فتح البرنامج", en: "Open program" },
  fm_no_programs: { ar: "لا توجد برامج", en: "No programs yet" },

  // ── Household ──
  fm_col_member: { ar: "الفرد", en: "Member" },
  fm_macros_head: {
    ar: "الماكروز (بروتين / كارب / دهون، غ)",
    en: "Macros (P / C / F, g)",
  },
  fm_role_cook: { ar: "الطبّاخة", en: "Cook" },

  // ── Billing / account / engagement ──
  fm_cancelled_at: { ar: "تاريخ الإلغاء", en: "Cancelled on" },
  fm_col_created: { ar: "أُنشئ", en: "Created" },
  fm_sign_in: { ar: "الدخول", en: "Sign-in" },
  fm_chat_last: { ar: "آخر محادثة", en: "Last chat" },

  // ── Summary facts ──
  fm_people: { ar: "الأفراد", en: "People" },
  fm_renews: { ar: "التجديد", en: "Renews" },
  fm_lifetime_ai: { ar: "تكلفة الذكاء الكلية", en: "Lifetime AI cost" },
  fm_last_active: { ar: "آخر نشاط", en: "Last active" },
  fm_trial_ends: { ar: "تنتهي التجربة", en: "Trial ends" },
  fm_plus_cook: { ar: "+ الطبّاخة", en: "+ cook" },
  fm_customer_since: { ar: "مشترك منذ", en: "Customer since" },

  // ── Runs ──
  fm_kind: { ar: "النوع", en: "Kind" },
  fm_kind_meal: { ar: "وجبات", en: "Meal" },
  fm_kind_workout: { ar: "تمارين", en: "Exercise" },

  // ── Flags ──
  fm_flag_failed_meal: { ar: "فشل إنشاء الوجبات", en: "Meal run failed" },
  fm_flag_failed_workout: { ar: "فشل برنامج التمارين", en: "Exercise run failed" },
  fm_flag_onboarding: { ar: "التسجيل غير مكتمل", en: "Onboarding incomplete" },

  // ── Attention reasons ──
  fm_reasons_label: { ar: "سبب ظهورها في القائمة", en: "Why this family needs attention" },
  fm_r_past_due: { ar: "الدفع متأخر{since}.", en: "Payment is past due{since}." },
  fm_r_since: { ar: " منذ {date}", en: " since {date}" },
  fm_r_over_limit: {
    ar: "{people} في الأسرة، والحد المسموح في الباقة {max}.",
    en: "{people} in the household; the tier allows {max}.",
  },
  fm_r_over_limit_nomax: {
    ar: "{people} في الأسرة، أكثر مما تسمح به الباقة.",
    en: "{people} in the household, more than the tier allows.",
  },
  fm_r_medical: {
    ar: "أحد أفراد الأسرة يحتاج تأكيد استشارة الطبيب، ولا تُنشأ خطط جديدة للأسرة حتى التأكيد.",
    en: "A household member needs a confirmed doctor consult; no new plans are made until it’s confirmed.",
  },
  fm_r_meal_high: {
    ar: "فشل إنشاء الخطة الغذائية{when}، ولا توجد خطة تُعرض للعائلة.",
    en: "The meal plan run{when} failed, and the family has no plan to see.",
  },
  fm_r_meal_medium: {
    ar: "فشل إنشاء الخطة الغذائية{when}، والخطة السابقة ما زالت معروضة للعائلة.",
    en: "The meal plan run{when} failed; the family still sees the previous plan.",
  },
  fm_r_meal_low: {
    ar: "فشلت عملية إنشاء وجبات{when}، والخطة الحالية جاهزة.",
    en: "A meal run{when} failed; the current plan is ready.",
  },
  fm_r_workout_high: {
    ar: "فشل إنشاء برنامج التمارين{when}، ولا يوجد برنامج يُعرض للعائلة.",
    en: "The exercise program run{when} failed, and the family has no program to see.",
  },
  fm_r_workout_medium: {
    ar: "فشل إنشاء برنامج التمارين{when}، والبرنامج السابق ما زال معروضاً للعائلة.",
    en: "The exercise program run{when} failed; the family still sees the previous program.",
  },
  fm_r_workout_low: {
    ar: "فشلت عملية تمارين{when}، والبرنامج الحالي جاهز.",
    en: "An exercise run{when} failed; the current program is ready.",
  },
  fm_r_cancel: { ar: "الإلغاء مجدول{when}.", en: "Cancellation is scheduled{when}." },
  fm_r_onboarding: { ar: "التسجيل غير مكتمل.", en: "Onboarding is incomplete." },
  fm_r_onboarding_trial: {
    ar: "التسجيل غير مكتمل، وموعد نهاية التجربة {date}.",
    en: "Onboarding is incomplete; the trial ends {date}.",
  },

  // ── Health link (confirm, then navigate to the audited page) ──
  fm_health_dialog_title: { ar: "فتح التفاصيل الصحية", en: "Open health detail" },
  fm_health_dialog_body: {
    ar: "تعرض هذه الصفحة الحالات الطبية والحساسية وتفاصيل الحمل لأفراد الأسرة.",
    en: "This page shows the household’s medical conditions, allergies and pregnancy detail.",
  },
  fm_health_dialog_audit: {
    ar: "يُسجَّل هذا العرض في سجل التدقيق باسمك (PDPL).",
    en: "This view is recorded in the audit log under your name (PDPL).",
  },
  fm_continue: { ar: "متابعة", en: "Continue" },
  fm_opening: { ar: "جارٍ الفتح…", en: "Opening…" },
} as const satisfies Record<string, Entry>;
