import { DirProvider } from "@/marketing/components/providers/direction-provider";

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
      <div className="overflow-x-clip">{children}</div>
    </DirProvider>
  );
}
