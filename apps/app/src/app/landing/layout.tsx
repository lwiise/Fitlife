import { DirProvider } from "@/marketing/components/providers/direction-provider";

// Thin layout for the standalone bundle-offer sales page. Deliberately NOT
// the (marketing) group layout: that one mounts ScrollToTop (a fixed FAB that
// would collide with this page's mobile sticky purchase bar) and the
// scroll-depth Providers. The offer page needs only Radix's RTL context.
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
