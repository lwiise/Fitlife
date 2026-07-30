import { RevealOnScroll } from "@/marketing/components/motion/RevealOnScroll";
import { CheckoutButton } from "@/marketing/bundle/ui/checkout-button";
import { CHECKOUT_ANCHOR_ID, CONFIG } from "@/marketing/bundle/config";

// Full-bleed night finale — bookends the hero's dark field; the footer
// continues it below so the page closes on one deep surface. Carries the
// #checkout anchor the secondary CTAs scroll to.
export function FinalCTA() {
  return (
    <section
      id={CHECKOUT_ANCHOR_ID}
      aria-labelledby="final-cta-title"
      className="bg-hero-night bg-noise scroll-mt-24 text-white"
    >
      <div className="container-page py-20 md:py-28">
        <RevealOnScroll>
          <div className="max-w-3xl">
            <h2 id="final-cta-title" className="text-offer-h2 text-white">
              قراركِ اليوم يوفّر عليك أكثر من{" "}
              <span className="text-gold-500 tabular-nums">660</span> ر.س…
              ويوفّر عليك شهور من التخبط.
            </h2>
            <p className="mt-5 text-lg leading-[1.7] text-brand-purple-100/85 md:text-xl">
              باقة كاملة، متابعة حقيقية، ونتيجة تشوفينها.
            </p>
            <div className="mt-10">
              <CheckoutButton
                label={`ابدئي الآن — ${CONFIG.bundlePrice} ر.س`}
                className="w-full sm:w-fit"
              />
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
