import { DirProvider } from "@/marketing/components/providers/direction-provider";
import { ScrollToTop } from "@/marketing/components/ui/ScrollToTop";
import { Providers } from "@/marketing/Providers";

// Nested layout for the marketing page only (no <html>/<body> — the root
// layout owns those). Hosts the landing's RTL provider and scroll-depth
// tracking. Analytics init, $pageview and the consent banner all moved to the
// ROOT layout when the authenticated funnel was instrumented — this layout
// covers only `/`, so anything mounted here misses every signed-in route.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DirProvider>
      <Providers>
        {/* overflow-x-clip kills any horizontal overflow from section decorations
            on mobile without creating a scroll container (sticky/fixed-safe) and
            without clipping vertical shadows. */}
        <div className="overflow-x-clip">{children}</div>
        <ScrollToTop />
      </Providers>
    </DirProvider>
  );
}
