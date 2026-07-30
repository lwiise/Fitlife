export const CONFIG = {
  originalValue: 1550,
  bundlePrice: 888,
  savings: 662,
  sallaCheckoutUrl: "REPLACE_WITH_SALLA_PRODUCT_URL", // primary CTA target
  whatsappNumber: "966562272609",
  whatsappMessage: "مرحباً، اشتريت باقة التحوّل الشاملة وهذه صورة فاتورتي 🧾",
} as const;

export function buildWhatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const whatsappUrl = buildWhatsappUrl(
  CONFIG.whatsappNumber,
  CONFIG.whatsappMessage,
);

// Sentinel id on the hero CTA — StickyBar's IntersectionObserver hides the
// mobile bottom bar while this element is in view.
export const HERO_CTA_ID = "hero-cta";
