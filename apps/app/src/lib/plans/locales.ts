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

/**
 * Static UI labels for the housekeeper view, per locale. en/ar are confident;
 * tl/id/bn/am/ur are best-effort and should get native-speaker review before scale.
 */
export const HOUSEKEEPER_STRINGS: Record<
  LocaleCode,
  {
    this_week: string;
    meals: string;
    ingredients: string;
    cooking_time: string; // "Cooking time" — minutes appended after
    minutes: string;
    switch_to_arabic: string;
    print: string;
    arabic_names_note: string;
    fallback_note: string;
  }
> = {
  ar: {
    this_week: "هذا الأسبوع",
    meals: "وجبات",
    ingredients: "المكونات",
    cooking_time: "وقت الطبخ",
    minutes: "دقيقة",
    switch_to_arabic: "العرض بالعربية",
    print: "طباعة",
    arabic_names_note: "الأسماء بالعربية",
    fallback_note: "أُنشئت قبل توفّر الترجمة. أنشئي خطة جديدة للوصفات المترجمة.",
  },
  en: {
    this_week: "This week",
    meals: "meals",
    ingredients: "Ingredients",
    cooking_time: "Cooking time",
    minutes: "minutes",
    switch_to_arabic: "Arabic view",
    print: "Print",
    arabic_names_note: "Names in Arabic",
    fallback_note: "Generated before translations were available. Regenerate the plan for translated recipes.",
  },
  tl: {
    this_week: "Ngayong linggo",
    meals: "pagkain",
    ingredients: "Mga sangkap",
    cooking_time: "Oras ng pagluluto",
    minutes: "minuto",
    switch_to_arabic: "Arabic view",
    print: "I-print",
    arabic_names_note: "Mga pangalan sa Arabic",
    fallback_note: "Ginawa bago available ang mga pagsasalin. I-regenerate ang plano para sa mga isinaling recipe.",
  },
  id: {
    this_week: "Minggu ini",
    meals: "makanan",
    ingredients: "Bahan",
    cooking_time: "Waktu memasak",
    minutes: "menit",
    switch_to_arabic: "Tampilan Arab",
    print: "Cetak",
    arabic_names_note: "Nama dalam bahasa Arab",
    fallback_note: "Dibuat sebelum terjemahan tersedia. Buat ulang rencana untuk resep terjemahan.",
  },
  bn: {
    this_week: "এই সপ্তাহ",
    meals: "খাবার",
    ingredients: "উপকরণ",
    cooking_time: "রান্নার সময়",
    minutes: "মিনিট",
    switch_to_arabic: "আরবি ভিউ",
    print: "প্রিন্ট",
    arabic_names_note: "নাম আরবিতে",
    fallback_note: "অনুবাদ উপলব্ধ হওয়ার আগে তৈরি। অনূদিত রেসিপির জন্য নতুন পরিকল্পনা তৈরি করুন।",
  },
  am: {
    this_week: "በዚህ ሳምንት",
    meals: "ምግቦች",
    ingredients: "ግብዓቶች",
    cooking_time: "የማብሰያ ጊዜ",
    minutes: "ደቂቃ",
    switch_to_arabic: "የአረብኛ እይታ",
    print: "አትም",
    arabic_names_note: "ስሞች በአረብኛ",
    fallback_note: "ትርጉም ከመገኘቱ በፊት የተፈጠረ። ለተተረጎሙ የምግብ አዘገጃጀቶች አዲስ እቅድ ይፍጠሩ።",
  },
  ur: {
    this_week: "اس ہفتے",
    meals: "کھانے",
    ingredients: "اجزاء",
    cooking_time: "پکانے کا وقت",
    minutes: "منٹ",
    switch_to_arabic: "عربی منظر",
    print: "پرنٹ",
    arabic_names_note: "نام عربی میں",
    fallback_note: "ترجمہ دستیاب ہونے سے پہلے بنایا گیا۔ ترجمہ شدہ ترکیبوں کے لیے نیا پلان بنائیں۔",
  },
};
