import { Hourglass } from "lucide-react";

import { OfferReceipt } from "@/components/sections/OfferReceipt";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { CONFIG, HERO_CTA_ID } from "@/lib/config";

// SERVER component — the LCP surface, on the night field. The H1 paints
// opaque on frame one; supporting rows stagger via CSS offer-rise. The only
// client leaf is the receipt's price ticker.
//
// The CTA renders twice (desktop column / after the receipt on mobile) so
// phones read badge → headline → receipt → action. The SECTION carries the
// sticky-bar sentinel id: the bar stays hidden while any part of the hero
// (which ends in the CTA) is on screen.
export function Hero() {
  return (
    <section
      id={HERO_CTA_ID}
      aria-labelledby="hero-title"
      className="bg-hero-night bg-noise overflow-hidden text-white"
    >
      <div className="container-page pt-28 pb-20 md:pt-40 md:pb-28">
        <div className="lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
          <div>
            <p className="offer-rise inline-flex min-h-8 items-center gap-2 rounded-full border border-gold-500/40 px-4 py-1.5 text-sm font-bold text-gold-500">
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

            <p className="offer-rise mt-6 max-w-xl text-lg leading-[1.7] text-brand-purple-100/85 [animation-delay:90ms] md:text-xl">
              بدل ما تشترين كل منتج لحاله، جمعنا لك الاستشارة والتمارين
              والتغذية والوصفات في عرض واحد بسعر أقل من نصف القيمة.
            </p>

            <div className="offer-rise mt-10 hidden lg:block [animation-delay:270ms]">
              <ShimmerButton
                href={CONFIG.sallaCheckoutUrl}
                className="px-12 py-4 text-lg"
              >
                احجزي باقتك الآن
              </ShimmerButton>
            </div>
          </div>

          <div className="offer-rise mt-14 lg:mt-0 [animation-delay:180ms]">
            <OfferReceipt />
          </div>
        </div>

        <div className="offer-rise mt-16 lg:hidden [animation-delay:360ms]">
          <ShimmerButton
            href={CONFIG.sallaCheckoutUrl}
            className="w-full px-10 py-4 text-lg"
          >
            احجزي باقتك الآن
          </ShimmerButton>
        </div>
      </div>
    </section>
  );
}
