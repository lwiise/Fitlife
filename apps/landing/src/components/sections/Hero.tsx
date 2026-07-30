import { Hourglass } from "lucide-react";

import { OfferReceipt } from "@/components/sections/OfferReceipt";
import { CheckoutButton } from "@/components/ui/checkout-button";
import { HERO_CTA_ID } from "@/lib/config";

// SERVER component — the LCP surface, on the night field. The H1 paints
// opaque on frame one; supporting rows stagger via CSS hero-rise. The only
// client leaf is the receipt's price ticker.
//
// The SECTION carries the sticky-bar sentinel id: the bar stays hidden while
// any part of the hero (which ends in the CTA) is on screen.
export function Hero() {
  return (
    <section
      id={HERO_CTA_ID}
      aria-labelledby="hero-title"
      className="bg-hero-night bg-noise overflow-hidden text-white"
    >
      <div className="container-page pt-28 pb-20 md:pt-40 md:pb-28">
        {/* One checkout widget, not one per breakpoint: DOM order is
            text → receipt → CTA (the mobile reading order), and on lg the
            receipt spans both rows in column 2 so the CTA sits under the
            paragraph in column 1. */}
        <div className="lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-20">
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="hero-rise inline-flex min-h-8 items-center gap-2 rounded-full border border-gold-500/40 px-4 py-1.5 text-sm font-bold text-gold-500">
              <Hourglass aria-hidden className="size-4" />
              عرض لفترة محدودة
            </p>

            <h1
              id="hero-title"
              className="text-offer-display mt-7 text-white"
            >
              كل ما تحتاجينه لتبدئي رحلتك…{" "}
              <span className="text-gold-500">في باقة واحدة</span>
            </h1>

            <p className="hero-rise mt-6 max-w-xl text-lg leading-[1.7] text-brand-purple-100/85 [animation-delay:160ms] md:text-xl">
              بدل ما تشترين كل منتج لحاله، جمعنا لك الاستشارة والتمارين
              والتغذية والوصفات في عرض واحد بسعر أقل من نصف القيمة.
            </p>
          </div>

          <div className="hero-rise mt-14 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center [animation-delay:200ms]">
            <OfferReceipt />
          </div>

          <div className="hero-rise mt-16 lg:col-start-1 lg:row-start-2 lg:mt-10 [animation-delay:280ms]">
            <CheckoutButton label="احجزي باقتك الآن" className="w-full lg:w-fit" />
          </div>
        </div>
      </div>
    </section>
  );
}
