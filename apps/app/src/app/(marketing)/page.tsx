import type { Metadata } from "next";
import Header from "@/marketing/components/sections/Header";
import Hero from "@/marketing/components/sections/Hero";
import SocialProofStrip from "@/marketing/components/sections/SocialProofStrip";
import Problem from "@/marketing/components/sections/Problem";
import HowItWorks from "@/marketing/components/sections/HowItWorks";
import FamilyMode from "@/marketing/components/sections/FamilyMode";
import ProductDemo from "@/marketing/components/sections/ProductDemo";
import Features from "@/marketing/components/sections/Features";
import Pricing from "@/marketing/components/sections/Pricing";
import Trust from "@/marketing/components/sections/Trust";
import Testimonials from "@/marketing/components/sections/Testimonials";
import FAQ from "@/marketing/components/sections/FAQ";
import WhatsAppCTA from "@/marketing/components/sections/WhatsAppCTA";
import FinalCTA from "@/marketing/components/sections/FinalCTA";
import Footer from "@/marketing/components/sections/Footer";

// The marketing homepage is public + indexable (overrides the root layout's
// app-wide robots: noindex).
export const metadata: Metadata = {
  title: "فت لايف — خطة غذائية لكل البيت",
  description:
    "ذكاء اصطناعي يصمم خطة غذائية لكل فرد في عائلتك، بلغته. مدعوم بخبيرة تغذية سعودية معتمدة. أول 7 أيام مجانية.",
  robots: { index: true, follow: true },
};

export default function MarketingHome() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        تخطّ إلى المحتوى
      </a>
      <Header />
      <main id="main" className="flex flex-1 flex-col">
        <Hero />
        <SocialProofStrip />
        <Problem />
        <HowItWorks />
        <FamilyMode />
        <ProductDemo />
        <Features />
        <Pricing />
        <Trust />
        <Testimonials />
        <FAQ />
        <WhatsAppCTA />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
