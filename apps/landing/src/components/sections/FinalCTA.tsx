import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { CONFIG } from "@/lib/config";

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-title">
      <div className="container-page py-16 md:py-24">
        <RevealOnScroll>
          <div className="bg-noise rounded-3xl bg-brand-purple-900 px-6 py-12 md:px-16 md:py-16">
            <div className="max-w-2xl">
              <h2
                id="final-cta-title"
                className="text-h2 leading-snug text-white"
              >
                قراركِ اليوم يوفّر عليك أكثر من{" "}
                <span className="text-gold-500 tabular-nums">660</span> ر.س…
                ويوفّر عليك شهور من التخبط.
              </h2>
              <p className="mt-4 text-lg leading-[1.7] text-white/85">
                باقة كاملة، متابعة حقيقية، ونتيجة تشوفينها.
              </p>
              <div className="mt-8">
                <ShimmerButton
                  href={CONFIG.sallaCheckoutUrl}
                  className="w-full px-10 text-lg sm:w-auto"
                >
                  ابدئي الآن —{" "}
                  <span className="tabular-nums">{CONFIG.bundlePrice}</span>{" "}
                  ر.س
                </ShimmerButton>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
