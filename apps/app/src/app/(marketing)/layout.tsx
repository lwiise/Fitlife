import { DirProvider } from "@/marketing/components/providers/direction-provider";
import { CookieConsent } from "@/marketing/components/CookieConsent";
import { ScrollToTop } from "@/marketing/components/ui/ScrollToTop";
import { Providers } from "@/marketing/Providers";

// Nested layout for the marketing page only (no <html>/<body> — the root
// layout owns those). Hosts the landing's RTL + analytics providers.
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
        <CookieConsent />
        <ScrollToTop />
      </Providers>
    </DirProvider>
  );
}
