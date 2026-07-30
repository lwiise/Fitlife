import { DealSealLottie } from "@/marketing/bundle/DealSealLottie";
import { Reveal } from "@/marketing/bundle/Reveal";
import { CheckoutButton } from "@/marketing/bundle/ui/checkout-button";
import { CHECKOUT_ANCHOR_ID, CONFIG } from "@/marketing/bundle/config";

// Full-bleed night finale — bookends the hero's dark field; the footer
// continues it below so the page closes on one deep surface. Carries the
// #checkout anchor the secondary CTAs scroll to.
//
// Two columns: the argument on the start side, the animation on the end side
// (RTL, so it reads text-right / illustration-left). DOM order is text first,
// which is also the mobile order — the checkout widget stays above the
// illustration instead of being pushed down by it.
export function FinalCTA() {
  return (
    <section
      id={CHECKOUT_ANCHOR_ID}
      aria-labelledby="final-cta-title"
      className="bg-hero-night bg-noise scroll-mt-24 overflow-hidden text-white"
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
              <CheckoutButton
                label={`ابدئي الآن — ${CONFIG.bundlePrice} ر.س`}
                className="w-full sm:w-fit"
              />
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
