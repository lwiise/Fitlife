import type { LocaleCode } from "@fitlife/plan-engine";

export type { LocaleCode };

/**
 * Frontend metadata for the 7 supported housekeeper languages. The LocaleCode
 * type is owned by the engine (schema.ts); this is the single source of truth
 * for display names + text direction in the app.
 */
export const LOCALE_INFO: Record<
  LocaleCode,
  {
    code: LocaleCode;
    native_name: string;
    ar_name: string;
    english_name: string;
    direction: "rtl" | "ltr";
  }
> = {
  ar: { code: "ar", native_name: "العربية", ar_name: "العربية", english_name: "Arabic", direction: "rtl" },
  en: { code: "en", native_name: "English", ar_name: "الإنجليزية", english_name: "English", direction: "ltr" },
  tl: { code: "tl", native_name: "Tagalog", ar_name: "الفلبينية", english_name: "Tagalog", direction: "ltr" },
  id: { code: "id", native_name: "Bahasa Indonesia", ar_name: "الإندونيسية", english_name: "Indonesian", direction: "ltr" },
  bn: { code: "bn", native_name: "বাংলা", ar_name: "البنغالية", english_name: "Bengali", direction: "ltr" },
  am: { code: "am", native_name: "አማርኛ", ar_name: "الأمهرية", english_name: "Amharic", direction: "ltr" },
  ur: { code: "ur", native_name: "اردو", ar_name: "الأوردو", english_name: "Urdu", direction: "rtl" },
};

export const LOCALE_CODES_ORDERED: LocaleCode[] = ["ar", "en", "tl", "id", "bn", "am", "ur"];

export function getLocaleInfo(code: LocaleCode) {
  return LOCALE_INFO[code];
}

/** Type guard for arbitrary strings coming from the DB. */
export function isLocaleCode(v: string | null | undefined): v is LocaleCode {
  return v != null && v in LOCALE_INFO;
}

type UnitKey =
  | "g" | "kg" | "ml" | "l" | "cup" | "tbsp" | "tsp" | "piece" | "serving" | "unlimited";

export interface PlanStrings {
  this_week: string;
  daily_calories: string;
  protein: string;
  carbs: string;
  fat: string;
  grams: string;
  day_total: string;
  calories_unit: string;
  you: string;
  generating: string;
  translating: string;
  day_queued: string;
  no_meals: string;
  empty_plan: string;
  prep_time: string;
  cook_time: string;
  min_abbr: string;
  servings_unit: string;
  family_recipe: string;
  ingredients: string;
  base_recipe: string;
  per_member_portions: string;
  prep_steps: string;
  substitutions: string;
  switch_to_arabic: string;
  print: string;
  arabic_names_note: string;
  day_failed: string;
  allergy_title: string;
  allergy_for: string;
  units: Record<UnitKey, string>;
}

/**
 * UI strings for PlanViewer/MealCard, per locale. `ar` mirrors the exact current
 * /plan literals (the wife's view must not change). en/ar confident; the others
 * are best-effort and should get native-speaker review before scale.
 */
export const PLAN_STRINGS: Record<LocaleCode, PlanStrings> = {
  ar: {
    this_week: "الأسبوع",
    daily_calories: "السعرات اليومية",
    protein: "بروتين",
    carbs: "كارب",
    fat: "دهون",
    grams: "جم",
    day_total: "إجمالي اليوم",
    calories_unit: "سعرة",
    you: "أنتِ",
    generating: "هذا اليوم لسه نجهّزه… بيظهر خلال لحظات",
    translating: "نجهّز الوصفات بلغتك… تظهر خلال لحظات",
    day_queued: "بنجهّز هذا اليوم بالترتيب — بعد الأيام اللي قبله",
    no_meals: "ما عندك وجبات لهذا اليوم",
    empty_plan: "الخطة فارغة. حاولي إعادة الإنشاء.",
    prep_time: "تحضير",
    cook_time: "طبخ",
    min_abbr: "د",
    servings_unit: "حصص",
    family_recipe: "وصفة العائلة",
    ingredients: "المكونات",
    base_recipe: "الوصفة الأساس",
    per_member_portions: "مقادير كل فرد",
    prep_steps: "طريقة التحضير",
    substitutions: "بدائل وتعديلات",
    switch_to_arabic: "العرض بالعربية",
    print: "طباعة",
    arabic_names_note: "الأسماء بالعربية",
    day_failed: "تعذّر تجهيز هذا اليوم. جرّبي إعادة الإنشاء.",
    allergy_title: "⚠ حساسية — لا تقدّمي هذه الأصناف",
    allergy_for: "لـ",
    units: { g: "جم", kg: "كجم", ml: "مل", l: "لتر", cup: "كوب", tbsp: "ملعقة كبيرة", tsp: "ملعقة صغيرة", piece: "حبة", serving: "حصة", unlimited: "حسب الرغبة" },
  },
  en: {
    this_week: "Week",
    daily_calories: "Daily calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    grams: "g",
    day_total: "Day total",
    calories_unit: "cal",
    you: "You",
    generating: "Still preparing this day… coming shortly",
    translating: "Preparing the recipes in your language… ready shortly",
    day_queued: "This day is queued — it comes after the earlier days",
    no_meals: "No meals for this day",
    empty_plan: "The plan is empty. Try regenerating.",
    prep_time: "Prep",
    cook_time: "Cook",
    min_abbr: "min",
    servings_unit: "servings",
    family_recipe: "Family recipe",
    ingredients: "Ingredients",
    base_recipe: "base recipe",
    per_member_portions: "Per-person amounts",
    prep_steps: "Steps",
    substitutions: "Substitutions",
    switch_to_arabic: "Arabic view",
    print: "Print",
    arabic_names_note: "Names in Arabic",
    day_failed: "This day couldn't be prepared. Try regenerating.",
    allergy_title: "⚠ Allergies — do not serve these",
    allergy_for: "For",
    units: { g: "g", kg: "kg", ml: "ml", l: "L", cup: "cup", tbsp: "tbsp", tsp: "tsp", piece: "pc", serving: "serving", unlimited: "as desired" },
  },
  tl: {
    this_week: "Linggo",
    daily_calories: "Calories kada araw",
    protein: "Protina",
    carbs: "Karbohidrat",
    fat: "Taba",
    grams: "g",
    day_total: "Kabuuan ng araw",
    calories_unit: "cal",
    you: "Ikaw",
    generating: "Inihahanda pa ang araw na ito…",
    translating: "Inihahanda ang mga recipe sa iyong wika… handa na sa ilang sandali",
    day_queued: "Nakapila ang araw na ito — kasunod ng mga naunang araw",
    no_meals: "Walang pagkain sa araw na ito",
    empty_plan: "Walang laman ang plano.",
    prep_time: "Paghahanda",
    cook_time: "Pagluluto",
    min_abbr: "min",
    servings_unit: "servings",
    family_recipe: "Recipe ng pamilya",
    ingredients: "Mga sangkap",
    base_recipe: "batayang recipe",
    per_member_portions: "Dami kada tao",
    prep_steps: "Mga hakbang",
    substitutions: "Mga kapalit",
    switch_to_arabic: "Arabic view",
    print: "I-print",
    arabic_names_note: "Mga pangalan sa Arabic",
    day_failed: "Hindi naihanda ang araw na ito. Subukang i-regenerate.",
    allergy_title: "⚠ Allergy — huwag ihain ang mga ito",
    allergy_for: "Para kay",
    units: { g: "g", kg: "kg", ml: "ml", l: "L", cup: "tasa", tbsp: "kutsara", tsp: "kutsarita", piece: "piraso", serving: "serving", unlimited: "ayon sa gusto" },
  },
  id: {
    this_week: "Minggu",
    daily_calories: "Kalori harian",
    protein: "Protein",
    carbs: "Karbohidrat",
    fat: "Lemak",
    grams: "g",
    day_total: "Total hari",
    calories_unit: "kal",
    you: "Anda",
    generating: "Masih menyiapkan hari ini…",
    translating: "Menyiapkan resep dalam bahasa Anda… segera siap",
    day_queued: "Hari ini dalam antrean — setelah hari-hari sebelumnya",
    no_meals: "Tidak ada makanan untuk hari ini",
    empty_plan: "Rencana kosong.",
    prep_time: "Persiapan",
    cook_time: "Memasak",
    min_abbr: "mnt",
    servings_unit: "porsi",
    family_recipe: "Resep keluarga",
    ingredients: "Bahan",
    base_recipe: "resep dasar",
    per_member_portions: "Takaran per orang",
    prep_steps: "Langkah",
    substitutions: "Pengganti",
    switch_to_arabic: "Tampilan Arab",
    print: "Cetak",
    arabic_names_note: "Nama dalam bahasa Arab",
    day_failed: "Hari ini gagal disiapkan. Coba buat ulang.",
    allergy_title: "⚠ Alergi — jangan sajikan ini",
    allergy_for: "Untuk",
    units: { g: "g", kg: "kg", ml: "ml", l: "L", cup: "cangkir", tbsp: "sdm", tsp: "sdt", piece: "buah", serving: "porsi", unlimited: "sesukanya" },
  },
  bn: {
    this_week: "সপ্তাহ",
    daily_calories: "দৈনিক ক্যালোরি",
    protein: "প্রোটিন",
    carbs: "কার্বোহাইড্রেট",
    fat: "ফ্যাট",
    grams: "গ্রাম",
    day_total: "দিনের মোট",
    calories_unit: "ক্যালোরি",
    you: "আপনি",
    generating: "এই দিনটি এখনও প্রস্তুত হচ্ছে…",
    translating: "আপনার ভাষায় রেসিপি প্রস্তুত হচ্ছে… শীঘ্রই দেখা যাবে",
    day_queued: "এই দিনটি সারিতে আছে — আগের দিনগুলোর পরে",
    no_meals: "এই দিনের জন্য কোনো খাবার নেই",
    empty_plan: "পরিকল্পনা খালি।",
    prep_time: "প্রস্তুতি",
    cook_time: "রান্না",
    min_abbr: "মিনিট",
    servings_unit: "পরিবেশন",
    family_recipe: "পরিবারের রেসিপি",
    ingredients: "উপকরণ",
    base_recipe: "মূল রেসিপি",
    per_member_portions: "জনপ্রতি পরিমাণ",
    prep_steps: "ধাপ",
    substitutions: "বিকল্প",
    switch_to_arabic: "আরবি ভিউ",
    print: "প্রিন্ট",
    arabic_names_note: "নাম আরবিতে",
    day_failed: "এই দিনটি প্রস্তুত করা যায়নি। আবার তৈরি করার চেষ্টা করুন।",
    allergy_title: "⚠ অ্যালার্জি — এগুলো পরিবেশন করবেন না",
    allergy_for: "জন্য",
    units: { g: "গ্রাম", kg: "কেজি", ml: "মিলি", l: "লিটার", cup: "কাপ", tbsp: "টেবিল চামচ", tsp: "চা চামচ", piece: "টুকরা", serving: "পরিবেশন", unlimited: "ইচ্ছেমতো" },
  },
  am: {
    this_week: "ሳምንት",
    daily_calories: "የቀን ካሎሪ",
    protein: "ፕሮቲን",
    carbs: "ካርቦሃይድሬት",
    fat: "ስብ",
    grams: "ግራም",
    day_total: "የቀኑ ጠቅላላ",
    calories_unit: "ካሎሪ",
    you: "እርስዎ",
    generating: "ይህ ቀን አሁንም በዝግጅት ላይ ነው…",
    translating: "የምግብ አዘገጃጀቶቹ በቋንቋዎ እየተዘጋጁ ነው… በቅርቡ ይታያል",
    day_queued: "ይህ ቀን በተራ ላይ ነው — ካለፉት ቀናት በኋላ",
    no_meals: "ለዚህ ቀን ምግብ የለም",
    empty_plan: "ዕቅዱ ባዶ ነው።",
    prep_time: "ዝግጅት",
    cook_time: "ማብሰል",
    min_abbr: "ደቂቃ",
    servings_unit: "ድርሻ",
    family_recipe: "የቤተሰብ የምግብ አዘገጃጀት",
    ingredients: "ግብዓቶች",
    base_recipe: "መሰረታዊ አዘገጃጀት",
    per_member_portions: "ለእያንዳንዱ ሰው መጠን",
    prep_steps: "ደረጃዎች",
    substitutions: "ምትኮች",
    switch_to_arabic: "የአረብኛ እይታ",
    print: "አትም",
    arabic_names_note: "ስሞች በአረብኛ",
    day_failed: "ይህ ቀን ሊዘጋጅ አልቻለም። እንደገና ለማመንጨት ይሞክሩ።",
    allergy_title: "⚠ አለርጂ — እነዚህን አታቅርቡ",
    allergy_for: "ለ",
    units: { g: "ግራም", kg: "ኪግ", ml: "ሚሊ", l: "ሊትር", cup: "ኩባያ", tbsp: "የሾርባ ማንኪያ", tsp: "የሻይ ማንኪያ", piece: "ቁራጭ", serving: "ድርሻ", unlimited: "እንደ ፍላጎት" },
  },
  ur: {
    this_week: "ہفتہ",
    daily_calories: "روزانہ کیلوریز",
    protein: "پروٹین",
    carbs: "کاربوہائیڈریٹ",
    fat: "چکنائی",
    grams: "گرام",
    day_total: "دن کا مجموعہ",
    calories_unit: "کیلوری",
    you: "آپ",
    generating: "یہ دن ابھی تیار ہو رہا ہے…",
    translating: "ترکیبیں آپ کی زبان میں تیار ہو رہی ہیں… تھوڑی دیر میں ظاہر ہوں گی",
    day_queued: "یہ دن قطار میں ہے — پچھلے دنوں کے بعد",
    no_meals: "اس دن کے لیے کوئی کھانا نہیں",
    empty_plan: "پلان خالی ہے۔",
    prep_time: "تیاری",
    cook_time: "پکانا",
    min_abbr: "منٹ",
    servings_unit: "سرونگ",
    family_recipe: "خاندانی ترکیب",
    ingredients: "اجزاء",
    base_recipe: "بنیادی ترکیب",
    per_member_portions: "فی فرد مقدار",
    prep_steps: "اقدامات",
    substitutions: "متبادل",
    switch_to_arabic: "عربی منظر",
    print: "پرنٹ",
    arabic_names_note: "نام عربی میں",
    day_failed: "یہ دن تیار نہیں ہو سکا۔ دوبارہ بنانے کی کوشش کریں۔",
    allergy_title: "⚠ الرجی — یہ چیزیں پیش نہ کریں",
    allergy_for: "برائے",
    units: { g: "گرام", kg: "کلوگرام", ml: "ملی لیٹر", l: "لیٹر", cup: "کپ", tbsp: "کھانے کا چمچ", tsp: "چائے کا چمچ", piece: "عدد", serving: "سرونگ", unlimited: "حسبِ خواہش" },
  },
};

export function getPlanStrings(locale: LocaleCode): PlanStrings {
  return PLAN_STRINGS[locale] ?? PLAN_STRINGS.ar;
}
