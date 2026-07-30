import type { Metadata } from "next";
import Script from "next/script";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/checkout.css";
import { RevealBootstrap } from "@/components/motion/Reveal";
import { DirProvider } from "@/components/providers/direction-provider";
import { SALLA } from "@/lib/config";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const TITLE =
  "باقة التحوّل الشاملة | Fit Life — استشارة + تمارين + تغذية بـ 888 ر.س";
const DESCRIPTION =
  "7 منتجات في عملية شراء واحدة: استشارة ومتابعة، برنامج تمارين، جدول غذائي حسب سعراتك، كنز الوصفات — قيمتها أكثر من 1,550 ر.س، اليوم بـ 888 ر.س فقط.";

export const metadata: Metadata = {
  // Checklist: point NEXT_PUBLIC_SITE_URL at the production domain before launch.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://offer.fitlife.example.com",
  ),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "Fit Life",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="antialiased">
        {/* First thing in the body: arms the scroll-reveal system before the
            sections are parsed, so nothing is ever painted and then hidden. */}
        <RevealBootstrap />
        {/* Radix reads direction from context, not the html dir attribute —
            load-bearing for the FAQ accordion (mirrored from the bundle
            sections, which get this from the /landing route layout). */}
        <DirProvider>{children}</DirProvider>
        {/* Salla fast-checkout. lazyOnload keeps it off the LCP path — the
            purchase buttons render from the page's own CSS fallback until it
            upgrades, so nothing is ever blank while this loads. */}
        <Script
          id="salla-fast-checkout"
          src={SALLA.widgetSrc}
          type="module"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
