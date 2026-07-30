export const CONFIG = {
  originalValue: 1550,
  bundlePrice: 888,
  savings: 662,
  whatsappNumber: "966562272609",
  whatsappMessage: "مرحباً، اشتريت باقة التحوّل الشاملة وهذه صورة فاتورتي 🧾",
} as const;

// Salla fast-checkout. The widget takes the store + product ids directly and
// opens Salla's hosted payment modal (Apple Pay / mada / Visa / Tabby …), so
// no product URL is needed. `productUrl` stays optional: set it to the store's
// product page and the fallback below becomes a real checkout link instead of
// a WhatsApp hand-off.
export const SALLA = {
  storeId: "1502078372",
  products: "[1893963313]",
  language: "ar",
  widgetSrc:
    "https://cdn.assets.salla.network/prod/@salla.sa/fast-checkout-widget/v0.0.25/widget.esm.js",
  productUrl: "",
} as const;

export function buildWhatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const whatsappUrl = buildWhatsappUrl(
  CONFIG.whatsappNumber,
  CONFIG.whatsappMessage,
);

// Order-enquiry hand-off used when the Salla widget can't load — a different
// message from the post-purchase invoice one, so a blocked shopper isn't told
// to send a receipt she doesn't have yet.
export const whatsappOrderUrl = buildWhatsappUrl(
  CONFIG.whatsappNumber,
  "مرحباً، أبغى أطلب باقة التحوّل الشاملة",
);

// Sentinel id on the HERO SECTION — StickyBar's IntersectionObserver hides
// the mobile bottom bar while any part of the hero (which ends in the CTA)
// is in view, and slides it in once the visitor scrolls past.
export const HERO_CTA_ID = "hero";

// Anchor on the closing purchase block. Secondary CTAs (header, ledger strip,
// sticky bar) point here rather than each mounting their own checkout widget.
export const CHECKOUT_ANCHOR_ID = "checkout";
