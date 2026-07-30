export const CONFIG = {
  originalValue: 1550,
  bundlePrice: 888,
  savings: 662,
  whatsappNumber: "966562272609",
  whatsappMessage: "مرحباً، اشتريت باقة التحوّل الشاملة وهذه صورة فاتورتي 🧾",
} as const;

// Salla checkout.
//
// We previously embedded Salla's fast-checkout widget here. It does NOT work
// on a non-Salla domain, and the failure was silent: the modal opened blank
// while the console showed 422 on api.salla.dev/store/v1/store/settings with
// the body {"error":{"message":"Store Identifier not found"}}. Cause, verified
// against the live API and the widget bundle:
//   • the widget issues no HTTP request itself — it postMessages an init
//     payload into a checkout iframe, and off a Salla storefront that iframe
//     defaults to demostore.salla.sa (a DIFFERENT store), which then boots
//     with no store identifier;
//   • api.salla.dev accepts the identifier only as `?store_id=` or a
//     `store-identifier:` header — neither of which our page can inject into
//     Salla's own iframe;
//   • Salla serves `content-security-policy: frame-ancestors 'self'
//     https://s.salla.sa https://mahally.com/ https://portal.salla.partners`,
//     which does not include our domain.
// The store and product ids below are both confirmed good — the ids were never
// the problem, the embedding context was.
//
// So checkout goes to the store's own product page, which is verified live
// (HTTP 200, «باقة التحوّل الشاملة», 888 ر.س, digital, in stock). Percent-
// encoded because the slug segment is Arabic and is REQUIRED — the short
// /p<id> form 410s.
export const SALLA = {
  storeId: "1502078372",
  productId: "1893963313",
  storeUsername: "fit-life-2026",
  // https://salla.sa/fit-life-2026/باقة-التحوّل-الشاملة/p1893963313
  productUrl:
    "https://salla.sa/fit-life-2026/%D8%A8%D8%A7%D9%82%D8%A9-%D8%A7%D9%84%D8%AA%D8%AD%D9%88%D9%91%D9%84-%D8%A7%D9%84%D8%B4%D8%A7%D9%85%D9%84%D8%A9/p1893963313",
} as const;

export function buildWhatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const whatsappUrl = buildWhatsappUrl(
  CONFIG.whatsappNumber,
  CONFIG.whatsappMessage,
);

// Order-enquiry hand-off — a different message from the post-purchase invoice
// one, so a shopper who wants to ask before buying isn't told to send a
// receipt she doesn't have yet.
export const whatsappOrderUrl = buildWhatsappUrl(
  CONFIG.whatsappNumber,
  "مرحباً، أبغى أطلب باقة التحوّل الشاملة",
);

// Sentinel id on the HERO SECTION — StickyBar's IntersectionObserver hides
// the mobile bottom bar while any part of the hero (which ends in the CTA)
// is in view, and slides it in once the visitor scrolls past.
export const HERO_CTA_ID = "hero";

// Anchor on the closing purchase block. Secondary CTAs (header, ledger strip,
// sticky bar) point here rather than each repeating the purchase control.
export const CHECKOUT_ANCHOR_ID = "checkout";
