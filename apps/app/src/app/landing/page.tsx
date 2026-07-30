import type { Metadata } from "next";

import { FAQ } from "@/marketing/bundle/sections/FAQ";
import { FinalCTA } from "@/marketing/bundle/sections/FinalCTA";
import { Footer } from "@/marketing/bundle/sections/Footer";
import { Header } from "@/marketing/bundle/sections/Header";
import { Hero } from "@/marketing/bundle/sections/Hero";
import { Steps } from "@/marketing/bundle/sections/Steps";
import { ValueStack } from "@/marketing/bundle/sections/ValueStack";
import { WhoFor } from "@/marketing/bundle/sections/WhoFor";
import { StickyBar } from "@/marketing/bundle/StickyBar";

const TITLE =
  "باقة التحوّل الشاملة | Fit Life — استشارة + تمارين + تغذية بـ 888 ر.س";
const DESCRIPTION =
  "7 منتجات في عملية شراء واحدة: استشارة ومتابعة، برنامج تمارين، جدول غذائي حسب سعراتك، كنز الوصفات — قيمتها أكثر من 1,550 ر.س، اليوم بـ 888 ر.س فقط.";

export const metadata: Metadata = {
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
  // Same caveat as "/": netlify.toml's CDN-level X-Robots-Tag still applies.
  robots: { index: true, follow: true },
};

export default function BundleLandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ValueStack />
        <WhoFor />
        <Steps />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyBar />
    </>
  );
}
