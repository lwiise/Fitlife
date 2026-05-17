export const SUBSCRIPTION_TIERS = {
  starter: { name: "البداية", monthlySAR: 29, annualSAR: 23 },
  pro: { name: "المتقدمة", monthlySAR: 59, annualSAR: 47 },
  family: { name: "العائلة", monthlySAR: 129, annualSAR: 103 },
  premium: { name: "البريميوم", monthlySAR: 249, annualSAR: 199 },
} as const;

export const SUPPORTED_LANGUAGES = [
  { code: "ar", name: "العربية", direction: "rtl" },
  { code: "en", name: "English", direction: "ltr" },
  { code: "tl", name: "Tagalog", direction: "ltr" },
  { code: "id", name: "Bahasa Indonesia", direction: "ltr" },
  { code: "bn", name: "বাংলা", direction: "ltr" },
  { code: "am", name: "አማርኛ", direction: "ltr" },
  { code: "ur", name: "اردو", direction: "rtl" },
] as const;

export const MAX_FAMILY_MEMBERS = 5;
export const FREE_TRIAL_DAYS = 7;
export const REFUND_WINDOW_DAYS = 14;
export const PLAN_REGENERATIONS_PER_WEEK = 3;

export const SAR_TO_USD_RATE = 0.27;
