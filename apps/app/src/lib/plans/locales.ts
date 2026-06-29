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
  awaiting_family: string;
  translation_queued: string;
  preparing_title: string;
  // Honest per-day process lines, cycled while a day generates (one atomic call,
  // so these describe the real work — not fake per-meal completion).
  preparing_steps: string[];
  day_queued: string;
  no_meals: string;
  empty_plan: string;
  prep_time: string;
  cook_time: string;
  min_abbr: string;
  servings_unit: string;
  family_recipe: string;
  shared_meal_with: string;
  shared_meal_tagline: string;
  your_portion: string;
  ingredients: string;
  base_recipe: string;
  per_member_portions: string;
  batch_total: string;
  prep_steps: string;
  substitutions: string;
  switch_to_arabic: string;
  print: string;
  back_to_dashboard: string;
  arabic_names_note: string;
  day_failed: string;
  allergy_title: string;
  allergy_for: string;
  allergy_disclaimer: string;
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
    awaiting_family: "خطط العائلة قيد الإعداد — ستظهر وصفاتك بلغتك فور اكتمالها",
    translation_queued: "وصفاتك في الطابور — نترجم من قبلك أولاً",
    preparing_title: "نجهّز خطتك",
    preparing_steps: [
      "نحسب سعرات هذا اليوم",
      "نختار وصفات تناسب ذوقك",
      "نوازن البروتين والنشويات والدهون",
      "نجهّز خطوات التحضير",
    ],
    day_queued: "بنجهّز أيامك واحد بعد الثاني، ودور هذا اليوم جاي",
    no_meals: "ما عندك وجبات لهذا اليوم",
    empty_plan: "الخطة فارغة. حاولي إعادة الإنشاء.",
    prep_time: "تحضير",
    cook_time: "طبخ",
    min_abbr: "د",
    servings_unit: "حصص",
    family_recipe: "وصفة العائلة",
    shared_meal_with: "وجبة مشتركة",
    shared_meal_tagline: "تُطبخ مرة واحدة وتُقسَّم على المشاركين",
    your_portion: "حصتك",
    ingredients: "المكونات",
    base_recipe: "الوصفة الأساس",
    per_member_portions: "مقادير كل فرد",
    batch_total: "إجمالي الطبق",
    prep_steps: "طريقة التحضير",
    substitutions: "بدائل وتعديلات",
    switch_to_arabic: "العرض بالعربية",
    print: "طباعة",
    back_to_dashboard: "العودة للوحة التحكم",
    arabic_names_note: "الأسماء بالعربية",
    day_failed: "تعذّر تجهيز هذا اليوم. جرّبي إعادة الإنشاء.",
    allergy_title: "⚠ حساسية — لا تقدّمي هذه الأصناف",
    allergy_for: "لـ",
    allergy_disclaimer: "هذه معلومات مساعِدة فقط — تحقّقي دائماً من المكونات بنفسك",
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
    awaiting_family: "The family's plans are still being prepared. Translation into your language will begin once they're ready.",
    translation_queued: "Queued — the earlier members are being translated first",
    preparing_title: "Preparing your plan",
    preparing_steps: [
      "Calculating today's calories",
      "Choosing recipes that fit your taste",
      "Balancing protein, carbs, and fat",
      "Writing the prep steps",
    ],
    day_queued: "We're preparing your days one after another — this one's turn is coming",
    no_meals: "No meals for this day",
    empty_plan: "The plan is empty. Try regenerating.",
    prep_time: "Prep",
    cook_time: "Cook",
    min_abbr: "min",
    servings_unit: "servings",
    family_recipe: "Family recipe",
    shared_meal_with: "Shared meal",
    shared_meal_tagline: "Cooked once, split between everyone",
    your_portion: "Your portion",
    ingredients: "Ingredients",
    base_recipe: "base recipe",
    per_member_portions: "Per-person amounts",
    batch_total: "Total batch",
    prep_steps: "Steps",
    substitutions: "Substitutions",
    switch_to_arabic: "Arabic view",
    print: "Print",
    back_to_dashboard: "Back to dashboard",
    arabic_names_note: "Names in Arabic",
    day_failed: "This day couldn't be prepared. Try regenerating.",
    allergy_title: "⚠ Allergies — do not serve these",
    allergy_for: "For",
    allergy_disclaimer: "This is decision-support only — always check the ingredients yourself",
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
    awaiting_family: "Inihahanda pa ang mga plano ng pamilya. Magsisimula ang pagsasalin sa iyong wika kapag handa na ang mga ito.",
    translation_queued: "Naka-queue — isinasalin muna ang mga naunang miyembro",
    preparing_title: "Inihahanda ang iyong plano",
    preparing_steps: [
      "Kinakalkula ang calories ng araw na ito",
      "Pumipili ng recipe na bagay sa panlasa mo",
      "Binabalanse ang protina, karbohidrat, at taba",
      "Inihahanda ang mga hakbang sa pagluluto",
    ],
    day_queued: "Inihahanda namin ang mga araw nang isa-isa — malapit nang dumating ang araw na ito",
    no_meals: "Walang pagkain sa araw na ito",
    empty_plan: "Walang laman ang plano.",
    prep_time: "Paghahanda",
    cook_time: "Pagluluto",
    min_abbr: "min",
    servings_unit: "servings",
    family_recipe: "Recipe ng pamilya",
    shared_meal_with: "Pinagsasaluhang pagkain",
    shared_meal_tagline: "Niluluto nang isang beses, hinahati sa lahat",
    your_portion: "Bahagi mo",
    ingredients: "Mga sangkap",
    base_recipe: "batayang recipe",
    per_member_portions: "Dami kada tao",
    batch_total: "Kabuuang luto",
    prep_steps: "Mga hakbang",
    substitutions: "Mga kapalit",
    switch_to_arabic: "Arabic view",
    print: "I-print",
    back_to_dashboard: "Bumalik sa dashboard",
    arabic_names_note: "Mga pangalan sa Arabic",
    day_failed: "Hindi naihanda ang araw na ito. Subukang i-regenerate.",
    allergy_title: "⚠ Allergy — huwag ihain ang mga ito",
    allergy_for: "Para kay",
    allergy_disclaimer: "Gabay-impormasyon lamang ito — laging suriin mismo ang mga sangkap",
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
    awaiting_family: "Rencana keluarga masih disiapkan. Penerjemahan ke bahasa Anda akan dimulai setelah semuanya siap.",
    translation_queued: "Dalam antrean — anggota sebelumnya diterjemahkan lebih dulu",
    preparing_title: "Menyiapkan rencana Anda",
    preparing_steps: [
      "Menghitung kalori hari ini",
      "Memilih resep sesuai selera Anda",
      "Menyeimbangkan protein, karbohidrat, dan lemak",
      "Menyiapkan langkah memasak",
    ],
    day_queued: "Kami menyiapkan hari-harimu satu per satu — giliran hari ini akan segera tiba",
    no_meals: "Tidak ada makanan untuk hari ini",
    empty_plan: "Rencana kosong.",
    prep_time: "Persiapan",
    cook_time: "Memasak",
    min_abbr: "mnt",
    servings_unit: "porsi",
    family_recipe: "Resep keluarga",
    shared_meal_with: "Makanan bersama",
    shared_meal_tagline: "Dimasak sekali, dibagi untuk semua",
    your_portion: "Porsi Anda",
    ingredients: "Bahan",
    base_recipe: "resep dasar",
    per_member_portions: "Takaran per orang",
    batch_total: "Total masakan",
    prep_steps: "Langkah",
    substitutions: "Pengganti",
    switch_to_arabic: "Tampilan Arab",
    print: "Cetak",
    back_to_dashboard: "Kembali ke dasbor",
    arabic_names_note: "Nama dalam bahasa Arab",
    day_failed: "Hari ini gagal disiapkan. Coba buat ulang.",
    allergy_title: "⚠ Alergi — jangan sajikan ini",
    allergy_for: "Untuk",
    allergy_disclaimer: "Ini hanya informasi pendukung — selalu periksa sendiri bahannya",
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
    awaiting_family: "পরিবারের পরিকল্পনা এখনও প্রস্তুত হচ্ছে। সব প্রস্তুত হলে আপনার ভাষায় অনুবাদ শুরু হবে।",
    translation_queued: "অপেক্ষমাণ — আগের সদস্যদের আগে অনুবাদ করা হচ্ছে",
    preparing_title: "আপনার পরিকল্পনা প্রস্তুত হচ্ছে",
    preparing_steps: [
      "আজকের ক্যালোরি হিসাব করা হচ্ছে",
      "আপনার পছন্দ অনুযায়ী রেসিপি বাছাই করা হচ্ছে",
      "প্রোটিন, কার্ব ও ফ্যাট ভারসাম্য করা হচ্ছে",
      "রান্নার ধাপ প্রস্তুত করা হচ্ছে",
    ],
    day_queued: "আমরা আপনার দিনগুলো একে একে প্রস্তুত করছি — এই দিনটির পালা আসছে",
    no_meals: "এই দিনের জন্য কোনো খাবার নেই",
    empty_plan: "পরিকল্পনা খালি।",
    prep_time: "প্রস্তুতি",
    cook_time: "রান্না",
    min_abbr: "মিনিট",
    servings_unit: "পরিবেশন",
    family_recipe: "পরিবারের রেসিপি",
    shared_meal_with: "ভাগ করা খাবার",
    shared_meal_tagline: "একবার রান্না, সবার মধ্যে ভাগ",
    your_portion: "আপনার ভাগ",
    ingredients: "উপকরণ",
    base_recipe: "মূল রেসিপি",
    per_member_portions: "জনপ্রতি পরিমাণ",
    batch_total: "মোট রান্না",
    prep_steps: "ধাপ",
    substitutions: "বিকল্প",
    switch_to_arabic: "আরবি ভিউ",
    print: "প্রিন্ট",
    back_to_dashboard: "ড্যাশবোর্ডে ফিরুন",
    arabic_names_note: "নাম আরবিতে",
    day_failed: "এই দিনটি প্রস্তুত করা যায়নি। আবার তৈরি করার চেষ্টা করুন।",
    allergy_title: "⚠ অ্যালার্জি — এগুলো পরিবেশন করবেন না",
    allergy_for: "জন্য",
    allergy_disclaimer: "এটি শুধুমাত্র সহায়ক তথ্য — সর্বদা উপাদানগুলো নিজে যাচাই করুন",
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
    awaiting_family: "የቤተሰቡ ዕቅዶች አሁንም በዝግጅት ላይ ናቸው። ሲጠናቀቁ ወደ ቋንቋዎ መተርጎም ይጀምራል።",
    translation_queued: "በመጠባበቅ ላይ — የቀደሙት ግለሰቦች መጀመሪያ ይተረጎማሉ",
    preparing_title: "ዕቅድዎን እያዘጋጀን ነው",
    preparing_steps: [
      "የዛሬውን ካሎሪ እያሰላን ነው",
      "ለጣዕምዎ የሚስማሙ የምግብ አዘገጃጀቶችን እንመርጣለን",
      "ፕሮቲን፣ ካርቦሃይድሬትና ስብ እናመዛዝናለን",
      "የማብሰያ ደረጃዎችን እናዘጋጃለን",
    ],
    day_queued: "ቀኖችዎን አንድ በአንድ እያዘጋጀን ነው — የዚህ ቀን ተራ በቅርቡ ይደርሳል",
    no_meals: "ለዚህ ቀን ምግብ የለም",
    empty_plan: "ዕቅዱ ባዶ ነው።",
    prep_time: "ዝግጅት",
    cook_time: "ማብሰል",
    min_abbr: "ደቂቃ",
    servings_unit: "ድርሻ",
    family_recipe: "የቤተሰብ የምግብ አዘገጃጀት",
    shared_meal_with: "የጋራ ምግብ",
    shared_meal_tagline: "አንድ ጊዜ ይበስላል፣ ለሁሉም ይከፋፈላል",
    your_portion: "የእርስዎ ድርሻ",
    ingredients: "ግብዓቶች",
    base_recipe: "መሰረታዊ አዘገጃጀት",
    per_member_portions: "ለእያንዳንዱ ሰው መጠን",
    batch_total: "ጠቅላላ ምግብ",
    prep_steps: "ደረጃዎች",
    substitutions: "ምትኮች",
    switch_to_arabic: "የአረብኛ እይታ",
    print: "አትም",
    back_to_dashboard: "ወደ ዳሽቦርድ ተመለስ",
    arabic_names_note: "ስሞች በአረብኛ",
    day_failed: "ይህ ቀን ሊዘጋጅ አልቻለም። እንደገና ለማመንጨት ይሞክሩ።",
    allergy_title: "⚠ አለርጂ — እነዚህን አታቅርቡ",
    allergy_for: "ለ",
    allergy_disclaimer: "ይህ የድጋፍ መረጃ ብቻ ነው — ሁልጊዜ ንጥረ ነገሮቹን እራስዎ ያረጋግጡ",
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
    awaiting_family: "خاندان کے منصوبے ابھی تیار ہو رہے ہیں۔ مکمل ہونے پر آپ کی زبان میں ترجمہ شروع ہوگا۔",
    translation_queued: "قطار میں — پہلے کے افراد کا ترجمہ پہلے ہو رہا ہے",
    preparing_title: "آپ کا پلان تیار ہو رہا ہے",
    preparing_steps: [
      "آج کی کیلوریز کا حساب لگایا جا رہا ہے",
      "آپ کے ذوق کے مطابق ترکیبیں منتخب کی جا رہی ہیں",
      "پروٹین، کاربوہائیڈریٹ اور چکنائی میں توازن",
      "پکانے کے مراحل تیار کیے جا رہے ہیں",
    ],
    day_queued: "ہم آپ کے دن یکے بعد دیگرے تیار کر رہے ہیں — اس دن کی باری آنے والی ہے",
    no_meals: "اس دن کے لیے کوئی کھانا نہیں",
    empty_plan: "پلان خالی ہے۔",
    prep_time: "تیاری",
    cook_time: "پکانا",
    min_abbr: "منٹ",
    servings_unit: "سرونگ",
    family_recipe: "خاندانی ترکیب",
    shared_meal_with: "مشترکہ کھانا",
    shared_meal_tagline: "ایک بار پکائی جاتی ہے، سب میں تقسیم",
    your_portion: "آپ کا حصہ",
    ingredients: "اجزاء",
    base_recipe: "بنیادی ترکیب",
    per_member_portions: "فی فرد مقدار",
    batch_total: "کل مقدار",
    prep_steps: "اقدامات",
    substitutions: "متبادل",
    switch_to_arabic: "عربی منظر",
    print: "پرنٹ",
    back_to_dashboard: "ڈیش بورڈ پر واپس",
    arabic_names_note: "نام عربی میں",
    day_failed: "یہ دن تیار نہیں ہو سکا۔ دوبارہ بنانے کی کوشش کریں۔",
    allergy_title: "⚠ الرجی — یہ چیزیں پیش نہ کریں",
    allergy_for: "برائے",
    allergy_disclaimer: "یہ صرف معاون معلومات ہے — اجزاء ہمیشہ خود جانچ لیں",
    units: { g: "گرام", kg: "کلوگرام", ml: "ملی لیٹر", l: "لیٹر", cup: "کپ", tbsp: "کھانے کا چمچ", tsp: "چائے کا چمچ", piece: "عدد", serving: "سرونگ", unlimited: "حسبِ خواہش" },
  },
};

export function getPlanStrings(locale: LocaleCode): PlanStrings {
  return PLAN_STRINGS[locale] ?? PLAN_STRINGS.ar;
}

/**
 * Strings for the plan-page owner controls (shared↔independent toggle + the
 * regenerate-scope chooser). Owner-facing only (hidden in the read-only
 * housekeeper view), so `ar` is authoritative and `en` solid; the others are
 * best-effort and should get native-speaker review before scale. `{name}` is
 * interpolated by the component.
 */
export interface PlanActionStrings {
  meal_mode_label: string;
  meal_mode_shared: string;
  meal_mode_independent: string;
  meal_mode_switch_title: string;
  meal_mode_to_independent_body: string;
  meal_mode_to_shared_body: string;
  meal_mode_confirm: string;
  regen_scope_title: string;
  regen_scope_both: string;
  regen_scope_both_hint: string;
  regen_scope_shared: string;
  regen_scope_shared_hint: string;
  regen_scope_individual: string;
  regen_scope_individual_hint: string;
  // Domain picker (meals vs workout) — shown only for a member with an exercise
  // plan. When it's shown, the meal-area scope picker above becomes a sub-question
  // (regen_scope_sub_title). The promote note appears when "exercise only" is
  // chosen but the edit moved the calorie math (it auto-promotes to both).
  regen_domain_title: string;
  regen_domain_both: string;
  regen_domain_both_hint: string;
  regen_domain_meals: string;
  regen_domain_meals_hint: string;
  regen_domain_exercise: string;
  regen_domain_exercise_hint: string;
  regen_domain_promote_note: string;
  regen_scope_sub_title: string;
}

export const PLAN_ACTION_STRINGS: Record<LocaleCode, PlanActionStrings> = {
  ar: {
    meal_mode_label: "نوع الوجبات",
    meal_mode_shared: "وجبات مشتركة",
    meal_mode_independent: "وجبات مستقلة",
    meal_mode_switch_title: "تغيير نوع الوجبات",
    meal_mode_to_independent_body:
      "بنحوّل وجبات {name} إلى وجبات مستقلة بأطباقه الخاصة، ونعيد إنشاءها. ونحدّث خطط الأفراد اللي كانوا يشاركونه تلقائياً. الخطة الحالية تنحفظ في السجل.",
    meal_mode_to_shared_body:
      "بنحوّل وجبات {name} إلى وجبات مشتركة مع العائلة حيثما تناسب، ونعيد إنشاءها. ونحدّث خطط الأفراد المشاركين تلقائياً. الخطة الحالية تنحفظ في السجل.",
    meal_mode_confirm: "غيّري النوع",
    regen_scope_title: "ايش تبين نجدد؟",
    regen_scope_both: "كل الوجبات",
    regen_scope_both_hint: "نجدد وجباته الخاصة والمشتركة",
    regen_scope_shared: "الوجبات المشتركة",
    regen_scope_shared_hint: "نجدد الأطباق اللي يشاركها مع العائلة — وتنعكس على بقية المشاركين",
    regen_scope_individual: "الأطباق الخاصة به",
    regen_scope_individual_hint: "نجدد وجباته الفردية فقط، والمشتركة تبقى كما هي",
    regen_domain_title: "ايش تبين نجدد؟",
    regen_domain_both: "الوجبات والتمارين",
    regen_domain_both_hint: "نجدد خطة الأكل وخطة التمارين",
    regen_domain_meals: "الوجبات فقط",
    regen_domain_meals_hint: "نجدد خطة الأكل، وخطة التمارين تبقى كما هي",
    regen_domain_exercise: "التمارين فقط",
    regen_domain_exercise_hint: "نجدد خطة التمارين، والوجبات تبقى كما هي",
    regen_domain_promote_note: "بنحدّث وجباتكِ أيضًا لأن نشاطكِ تغيّر",
    regen_scope_sub_title: "أي وجبات نجدد؟",
  },
  en: {
    meal_mode_label: "Meal type",
    meal_mode_shared: "Shared meals",
    meal_mode_independent: "Own meals",
    meal_mode_switch_title: "Change meal type",
    meal_mode_to_independent_body:
      "We'll switch {name} to their own separate dishes and regenerate them. Anyone who shared meals with them is updated automatically. Your current plan is saved to history.",
    meal_mode_to_shared_body:
      "We'll switch {name} to the family's shared meals where they fit and regenerate them. The members who share are updated automatically. Your current plan is saved to history.",
    meal_mode_confirm: "Change type",
    regen_scope_title: "What would you like to regenerate?",
    regen_scope_both: "All meals",
    regen_scope_both_hint: "Regenerate their own and their shared meals",
    regen_scope_shared: "Shared meals",
    regen_scope_shared_hint: "Regenerate the dishes shared with the family — co-sharers update too",
    regen_scope_individual: "Their own dishes",
    regen_scope_individual_hint: "Regenerate only their individual meals; shared meals stay",
    regen_domain_title: "What would you like to refresh?",
    regen_domain_both: "Meals and exercise",
    regen_domain_both_hint: "Regenerate both the meal plan and the workout",
    regen_domain_meals: "Meals only",
    regen_domain_meals_hint: "Regenerate the meal plan; the workout stays as is",
    regen_domain_exercise: "Exercise only",
    regen_domain_exercise_hint: "Regenerate the workout; the meals stay as is",
    regen_domain_promote_note: "We'll refresh your meals too, since your activity changed",
    regen_scope_sub_title: "Which meals?",
  },
  tl: {
    meal_mode_label: "Uri ng pagkain",
    meal_mode_shared: "Magkakasamang pagkain",
    meal_mode_independent: "Sariling pagkain",
    meal_mode_switch_title: "Baguhin ang uri ng pagkain",
    meal_mode_to_independent_body:
      "Ililipat namin si {name} sa sariling hiwalay na mga pagkain at gagawa ng bago. Ang sinumang kasalo niya ay awtomatikong ia-update. Ang kasalukuyang plano ay nakatabi sa history.",
    meal_mode_to_shared_body:
      "Ililipat namin si {name} sa magkakasamang pagkain ng pamilya kung saan bagay at gagawa ng bago. Ang mga kasalo ay awtomatikong ia-update. Ang kasalukuyang plano ay nakatabi sa history.",
    meal_mode_confirm: "Baguhin ang uri",
    regen_scope_title: "Ano ang gusto mong gawing bago?",
    regen_scope_both: "Lahat ng pagkain",
    regen_scope_both_hint: "Gawing bago ang sarili at magkakasamang pagkain",
    regen_scope_shared: "Magkakasamang pagkain",
    regen_scope_shared_hint: "Gawing bago ang mga pagkaing kasalo ng pamilya — maa-update din sila",
    regen_scope_individual: "Sariling pagkain niya",
    regen_scope_individual_hint: "Gawing bago lang ang indibidwal na pagkain; mananatili ang magkakasama",
    regen_domain_title: "Ano ang gusto mong i-refresh?",
    regen_domain_both: "Pagkain at ehersisyo",
    regen_domain_both_hint: "Gawing bago ang plano ng pagkain at ang ehersisyo",
    regen_domain_meals: "Pagkain lang",
    regen_domain_meals_hint: "Gawing bago ang pagkain; mananatili ang ehersisyo",
    regen_domain_exercise: "Ehersisyo lang",
    regen_domain_exercise_hint: "Gawing bago ang ehersisyo; mananatili ang pagkain",
    regen_domain_promote_note: "I-re-refresh din namin ang iyong pagkain dahil nagbago ang iyong aktibidad",
    regen_scope_sub_title: "Aling pagkain?",
  },
  id: {
    meal_mode_label: "Jenis makanan",
    meal_mode_shared: "Makanan bersama",
    meal_mode_independent: "Makanan sendiri",
    meal_mode_switch_title: "Ubah jenis makanan",
    meal_mode_to_independent_body:
      "Kami akan mengubah {name} ke hidangan sendiri yang terpisah dan membuatnya ulang. Siapa pun yang berbagi makanan dengannya akan diperbarui otomatis. Rencana saat ini disimpan di riwayat.",
    meal_mode_to_shared_body:
      "Kami akan mengubah {name} ke makanan bersama keluarga jika sesuai dan membuatnya ulang. Anggota yang berbagi diperbarui otomatis. Rencana saat ini disimpan di riwayat.",
    meal_mode_confirm: "Ubah jenis",
    regen_scope_title: "Apa yang ingin dibuat ulang?",
    regen_scope_both: "Semua makanan",
    regen_scope_both_hint: "Buat ulang makanan sendiri dan bersama",
    regen_scope_shared: "Makanan bersama",
    regen_scope_shared_hint: "Buat ulang hidangan yang dibagi dengan keluarga — yang lain ikut diperbarui",
    regen_scope_individual: "Hidangan sendiri",
    regen_scope_individual_hint: "Buat ulang hanya makanan individunya; yang bersama tetap",
    regen_domain_title: "Apa yang ingin diperbarui?",
    regen_domain_both: "Makanan dan olahraga",
    regen_domain_both_hint: "Buat ulang rencana makan dan latihan",
    regen_domain_meals: "Makanan saja",
    regen_domain_meals_hint: "Buat ulang rencana makan; latihan tetap",
    regen_domain_exercise: "Olahraga saja",
    regen_domain_exercise_hint: "Buat ulang latihan; makanan tetap",
    regen_domain_promote_note: "Kami juga memperbarui makananmu karena aktivitasmu berubah",
    regen_scope_sub_title: "Makanan yang mana?",
  },
  bn: {
    meal_mode_label: "খাবারের ধরন",
    meal_mode_shared: "ভাগ করা খাবার",
    meal_mode_independent: "নিজের খাবার",
    meal_mode_switch_title: "খাবারের ধরন পরিবর্তন",
    meal_mode_to_independent_body:
      "আমরা {name}-কে তার নিজের আলাদা খাবারে পরিবর্তন করে নতুন করে তৈরি করব। যারা তার সাথে খাবার ভাগ করত তারা স্বয়ংক্রিয়ভাবে হালনাগাদ হবে। বর্তমান পরিকল্পনা ইতিহাসে সংরক্ষিত থাকে।",
    meal_mode_to_shared_body:
      "আমরা {name}-কে যেখানে মানানসই সেখানে পরিবারের ভাগ করা খাবারে পরিবর্তন করে নতুন করে তৈরি করব। যারা ভাগ করে তারা স্বয়ংক্রিয়ভাবে হালনাগাদ হবে। বর্তমান পরিকল্পনা ইতিহাসে সংরক্ষিত থাকে।",
    meal_mode_confirm: "ধরন পরিবর্তন",
    regen_scope_title: "আপনি কী নতুন করে তৈরি করতে চান?",
    regen_scope_both: "সব খাবার",
    regen_scope_both_hint: "তার নিজের ও ভাগ করা খাবার নতুন করে তৈরি",
    regen_scope_shared: "ভাগ করা খাবার",
    regen_scope_shared_hint: "পরিবারের সাথে ভাগ করা খাবার নতুন করা — অন্যরাও হালনাগাদ হবে",
    regen_scope_individual: "তার নিজের খাবার",
    regen_scope_individual_hint: "শুধু তার একক খাবার নতুন করা; ভাগ করা খাবার অপরিবর্তিত থাকে",
    regen_domain_title: "আপনি কী নতুন করতে চান?",
    regen_domain_both: "খাবার ও ব্যায়াম",
    regen_domain_both_hint: "খাবার ও ব্যায়াম দুটোই নতুন করে তৈরি",
    regen_domain_meals: "শুধু খাবার",
    regen_domain_meals_hint: "খাবার নতুন করা; ব্যায়াম অপরিবর্তিত থাকে",
    regen_domain_exercise: "শুধু ব্যায়াম",
    regen_domain_exercise_hint: "ব্যায়াম নতুন করা; খাবার অপরিবর্তিত থাকে",
    regen_domain_promote_note: "আপনার কার্যকলাপ বদলেছে বলে আমরা আপনার খাবারও হালনাগাদ করব",
    regen_scope_sub_title: "কোন খাবার?",
  },
  am: {
    meal_mode_label: "የምግብ ዓይነት",
    meal_mode_shared: "የጋራ ምግቦች",
    meal_mode_independent: "የራሱ ምግቦች",
    meal_mode_switch_title: "የምግብ ዓይነት ለውጥ",
    meal_mode_to_independent_body:
      "{name}ን ወደ የራሱ የተለዩ ምግቦች እንቀይራለን አዲስም እናዘጋጃለን። ከእሱ ጋር ምግብ ይጋሩ የነበሩ ሁሉ በራስ-ሰር ይዘምናሉ። የአሁኑ እቅድ በታሪክ ይቀመጣል።",
    meal_mode_to_shared_body:
      "{name}ን በሚስማማበት ቦታ ወደ የቤተሰብ የጋራ ምግቦች እንቀይራለን አዲስም እናዘጋጃለን። የሚጋሩ አባላት በራስ-ሰር ይዘምናሉ። የአሁኑ እቅድ በታሪክ ይቀመጣል።",
    meal_mode_confirm: "ዓይነት ለውጥ",
    regen_scope_title: "ምን እንዲታደስ ይፈልጋሉ?",
    regen_scope_both: "ሁሉም ምግቦች",
    regen_scope_both_hint: "የራሱንና የጋራ ምግቦቹን እናድሳለን",
    regen_scope_shared: "የጋራ ምግቦች",
    regen_scope_shared_hint: "ከቤተሰብ ጋር የሚጋሩ ምግቦችን እናድሳለን — ሌሎቹም ይዘምናሉ",
    regen_scope_individual: "የራሱ ምግቦች",
    regen_scope_individual_hint: "የግል ምግቦቹን ብቻ እናድሳለን፤ የጋራዎቹ እንዳሉ ይቆያሉ",
    regen_domain_title: "ምን እንዲታደስ ይፈልጋሉ?",
    regen_domain_both: "ምግብና የአካል ብቃት",
    regen_domain_both_hint: "የምግብና የልምምድ እቅድ ሁለቱንም እናድሳለን",
    regen_domain_meals: "ምግብ ብቻ",
    regen_domain_meals_hint: "የምግብ እቅድ እናድሳለን፤ ልምምዱ እንዳለ ይቆያል",
    regen_domain_exercise: "ልምምድ ብቻ",
    regen_domain_exercise_hint: "ልምምዱን እናድሳለን፤ ምግቡ እንዳለ ይቆያል",
    regen_domain_promote_note: "እንቅስቃሴዎ ስለተቀየረ ምግብዎንም እናድሳለን",
    regen_scope_sub_title: "የትኞቹ ምግቦች?",
  },
  ur: {
    meal_mode_label: "کھانے کی قسم",
    meal_mode_shared: "مشترکہ کھانے",
    meal_mode_independent: "اپنے کھانے",
    meal_mode_switch_title: "کھانے کی قسم تبدیل کریں",
    meal_mode_to_independent_body:
      "ہم {name} کو اپنے الگ کھانوں میں منتقل کر کے دوبارہ بنائیں گے۔ جو لوگ ان کے ساتھ کھانے بانٹتے تھے وہ خود بخود اپ ڈیٹ ہو جائیں گے۔ موجودہ پلان تاریخ میں محفوظ رہتا ہے۔",
    meal_mode_to_shared_body:
      "ہم {name} کو جہاں مناسب ہو خاندان کے مشترکہ کھانوں میں منتقل کر کے دوبارہ بنائیں گے۔ شریک افراد خود بخود اپ ڈیٹ ہو جائیں گے۔ موجودہ پلان تاریخ میں محفوظ رہتا ہے۔",
    meal_mode_confirm: "قسم تبدیل کریں",
    regen_scope_title: "آپ کیا دوبارہ بنانا چاہتی ہیں؟",
    regen_scope_both: "تمام کھانے",
    regen_scope_both_hint: "ان کے اپنے اور مشترکہ کھانے دوبارہ بنائیں",
    regen_scope_shared: "مشترکہ کھانے",
    regen_scope_shared_hint: "خاندان کے ساتھ مشترکہ کھانے دوبارہ بنائیں — باقی بھی اپ ڈیٹ ہوں گے",
    regen_scope_individual: "ان کے اپنے کھانے",
    regen_scope_individual_hint: "صرف ان کے انفرادی کھانے دوبارہ بنائیں؛ مشترکہ ویسے ہی رہیں گے",
    regen_domain_title: "آپ کیا تازہ کرنا چاہتی ہیں؟",
    regen_domain_both: "کھانے اور ورزش",
    regen_domain_both_hint: "کھانے اور ورزش دونوں دوبارہ بنائیں",
    regen_domain_meals: "صرف کھانے",
    regen_domain_meals_hint: "کھانے دوبارہ بنائیں؛ ورزش ویسے ہی رہے گی",
    regen_domain_exercise: "صرف ورزش",
    regen_domain_exercise_hint: "ورزش دوبارہ بنائیں؛ کھانے ویسے ہی رہیں گے",
    regen_domain_promote_note: "آپ کی سرگرمی بدل گئی ہے اس لیے ہم آپ کے کھانے بھی تازہ کریں گے",
    regen_scope_sub_title: "کون سے کھانے؟",
  },
};

export function getPlanActionStrings(locale: LocaleCode): PlanActionStrings {
  return PLAN_ACTION_STRINGS[locale] ?? PLAN_ACTION_STRINGS.ar;
}
