import { Hourglass } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { CONFIG, HERO_CTA_ID } from "@/lib/config";

// SERVER component — the LCP surface. The H1 paints opaque on frame one (no
// entrance animation on the LCP element); the supporting rows stagger in via
// CSS hero-rise. The only client leaf is NumberTicker.
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-hero-spotlight overflow-hidden"
    >
      <div className="container-page pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="max-w-2xl">
          <Badge
            variant="soft"
            className="hero-rise px-4 py-1.5 text-sm shadow-sm"
          >
            <Hourglass aria-hidden className="size-4" />
            عرض لفترة محدودة
          </Badge>

          <h1
            id="hero-title"
            className="text-display mt-6 text-brand-purple-900"
          >
            كل ما تحتاجينه لتبدئي رحلتك… في باقة واحدة
          </h1>

          <p className="hero-rise mt-5 max-w-xl text-lg leading-[1.7] text-brand-ink-muted [animation-delay:160ms]">
            بدل ما تشترين كل منتج لحاله، جمعنا لك الاستشارة والتمارين والتغذية
            والوصفات في عرض واحد بسعر أقل من نصف القيمة.
          </p>

          {/* Price anchor — a deep-purple price tag where gold numerals pass
              contrast. The ticker drops 1,550 → 888 when it enters view; the
              reserved width (min-w) keeps the drop from shifting layout. */}
          <div className="hero-rise mt-9 flex flex-wrap items-center gap-4 [animation-delay:240ms]">
            <div className="bg-noise rounded-2xl bg-brand-purple-900 px-6 py-4 shadow-lg">
              <s className="block text-sm font-medium text-white/70">
                <span className="sr-only">السعر الأصلي </span>
                أكثر من <span className="tabular-nums">1,550</span> ر.س
              </s>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="sr-only">سعر الباقة </span>
                <NumberTicker
                  value={CONFIG.originalValue}
                  startValue={CONFIG.bundlePrice}
                  direction="down"
                  className="text-gold-500 min-w-[4.6ch] text-5xl font-extrabold md:text-6xl"
                />
                <span className="text-lg font-bold text-white">ر.س</span>
              </p>
            </div>
            <Badge variant="gold" className="px-4 py-1.5 text-sm shadow-md">
              وفّري أكثر من 660 ر.س
            </Badge>
          </div>

          <div className="hero-rise mt-9 [animation-delay:320ms]">
            <ShimmerButton
              id={HERO_CTA_ID}
              href={CONFIG.sallaCheckoutUrl}
              className="w-full px-10 text-lg sm:w-auto"
            >
              احجزي باقتك الآن
            </ShimmerButton>
          </div>
        </div>
      </div>
    </section>
  );
}
