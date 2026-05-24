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
        {children}
        <CookieConsent />
        <ScrollToTop />
      </Providers>
    </DirProvider>
  );
}
