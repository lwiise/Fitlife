// NOTE: pricing lives in ./pricing.ts and nowhere else.
//
// A second tier table used to sit here — SUBSCRIPTION_TIERS, with `annualSAR`
// values of 23/47/103/199. Those were per-MONTH equivalents under a field name
// that reads as an annual total, alongside MAX_FAMILY_MEMBERS = 5 contradicting
// family's 6 and premium's unlimited. Nothing imported any of it, so it was
// silently wrong while looking authoritative — exactly the file someone would
// edit believing they were changing prices. Removed 07/2026.
//
// PRICING_TIERS in ./pricing.ts is the single source of truth: price_monthly_sar,
// price_annual_sar (a real annual total), max_people, and the LS variant IDs.

export const SUPPORTED_LANGUAGES = [
  { code: "ar", name: "العربية", direction: "rtl" },
  { code: "en", name: "English", direction: "ltr" },
  { code: "tl", name: "Tagalog", direction: "ltr" },
  { code: "id", name: "Bahasa Indonesia", direction: "ltr" },
  { code: "bn", name: "বাংলা", direction: "ltr" },
  { code: "am", name: "አማርኛ", direction: "ltr" },
  { code: "ur", name: "اردو", direction: "rtl" },
] as const;

// MAX_FAMILY_MEMBERS / FREE_TRIAL_DAYS / REFUND_WINDOW_DAYS /
// PLAN_REGENERATIONS_PER_WEEK were removed with the dead tier table above:
// unimported, and each contradicted the value the code actually uses
// (max_people per tier in ./pricing.ts, TRIAL_DAYS there too, the weekly plan
// limits in lib/subscription/access.ts). REFUND_WINDOW_DAYS in particular
// implied a refund policy the product has no mechanism for.

/** Used by the admin margin dashboard to compare AI cost (USD) against MRR (SAR). */
export const SAR_TO_USD_RATE = 0.27;
