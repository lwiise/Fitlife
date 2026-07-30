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
// So checkout goes straight to Salla's fast-payment link for the product
// (owner directive 07/2026). It 302s into a fresh checkout session — verified
// live: the redirect lands on «إتمام الطلب» at 888 ر.س. That is one step
// closer to paying than the product page it replaced, which required the
// shopper to press "buy" again before anything happened.
//
// Note this URL is NOT the product page: the product page needs the Arabic
// slug segment percent-encoded (its short /p<id> form 410s), whereas the
// payment path takes the bare product id and mints the session itself.
export const SALLA = {
  storeId: "1502078372",
  productId: "1893963313",
  storeUsername: "fit-life-2026",
  productUrl: "https://salla.sa/fit-life-2026/payment/p1893963313",
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
