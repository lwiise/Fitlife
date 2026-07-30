import { RevealOnScroll } from "@/marketing/components/motion/RevealOnScroll";
import { ShimmerButton } from "@/marketing/bundle/ui/shimmer-button";
import { CONFIG } from "@/marketing/bundle/config";

// Full-bleed night finale — bookends the hero's dark field; the footer
// continues it below so the page closes on one deep surface.
export function FinalCTA() {
  return (
    <section
      aria-labelledby="final-cta-title"
      className="bg-hero-night bg-noise text-white"
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
              <ShimmerButton
                href={CONFIG.sallaCheckoutUrl}
                className="w-full px-12 py-4 text-lg sm:w-auto"
              >
                ابدئي الآن —{" "}
                <span className="tabular-nums">{CONFIG.bundlePrice}</span> ر.س
              </ShimmerButton>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
