import { DealSealLottie } from "@/components/DealSealLottie";
import { Reveal } from "@/components/motion/Reveal";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { CONFIG } from "@/lib/config";

// Full-bleed night finale — bookends the hero's dark field; the footer
// continues it below so the page closes on one deep surface.
//
// Two columns: the argument on the start side, the animation on the end side
// (RTL, so it reads text-right / illustration-left). DOM order is text first,
// which is also the mobile order — the CTA stays above the fold-fold instead
// of being pushed down by an illustration.
export function FinalCTA() {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="bg-hero-night bg-noise overflow-hidden text-white"
    >
      <div className="container-page section-shell lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
        <Reveal>
          <div className="max-w-2xl">
            <h2 id="final-cta-title" className="text-offer-h2 text-white">
              قراركِ اليوم يوفّر عليك أكثر من{" "}
              <span className="text-gold-500 tabular-nums">660</span> ر.س…
              ويوفّر عليك شهور من التخبط.
            </h2>
            <p className="mt-6 text-lg leading-[1.8] text-brand-purple-100/85 md:text-xl">
              باقة كاملة، متابعة حقيقية، ونتيجة تشوفينها.
            </p>
            <div className="mt-11">
              <ShimmerButton
                href={CONFIG.sallaCheckoutUrl}
                className="w-full px-12 py-4 text-lg sm:w-auto"
              >
                ابدئي الآن —{" "}
                <span className="tabular-nums">{CONFIG.bundlePrice}</span> ر.س
              </ShimmerButton>
            </div>
          </div>
        </Reveal>

        <Reveal variant="fade" delayIndex={2} className="mt-14 lg:mt-0">
          <DealSealLottie />
        </Reveal>
      </div>
    </section>
  );
}
