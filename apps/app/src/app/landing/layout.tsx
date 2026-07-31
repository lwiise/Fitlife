import { DirProvider } from "@/marketing/components/providers/direction-provider";
import { RevealBootstrap } from "@/marketing/bundle/Reveal";

// Thin layout for the bundle-offer sales page. Deliberately NOT the
// (marketing) group layout: that one mounts ScrollToTop (a fixed FAB that
// would collide with this page's mobile sticky purchase bar) and the
// scroll-depth Providers. The offer page needs only Radix's RTL context.
//
// No third-party checkout script: the purchase control is a plain link to the
// Salla product page (see marketing/bundle/config.ts for why the embedded
// fast-checkout widget was removed).
export default function BundleLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DirProvider>
      {/* Ahead of the sections: arms the scroll-reveal system before they are
          parsed, so nothing is ever painted and then hidden. Scoped to this
          route — the SaaS pages never render it, and it touches no element
          React owns, so it cannot collide with hydration anywhere. */}
      <RevealBootstrap />
      <div className="overflow-x-clip">{children}</div>
    </DirProvider>
  );
}
