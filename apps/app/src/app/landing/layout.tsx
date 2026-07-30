import Script from "next/script";

import { DirProvider } from "@/marketing/components/providers/direction-provider";
import { SALLA } from "@/marketing/bundle/config";
import "@/marketing/bundle/checkout.css";

// Thin layout for the standalone bundle-offer sales page. Deliberately NOT
// the (marketing) group layout: that one mounts ScrollToTop (a fixed FAB that
// would collide with this page's mobile sticky purchase bar) and the
// scroll-depth Providers. The offer page needs only Radix's RTL context plus
// Salla's checkout widget.
export default function BundleLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DirProvider>
      <div className="overflow-x-clip">{children}</div>
      {/* Salla fast-checkout. lazyOnload keeps it off the LCP path — the
          purchase buttons render from the page's own CSS fallback until it
          upgrades, so nothing is ever blank while this loads. */}
      <Script
        id="salla-fast-checkout"
        src={SALLA.widgetSrc}
        type="module"
        strategy="lazyOnload"
      />
    </DirProvider>
  );
}
