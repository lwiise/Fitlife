import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";
import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { Steps } from "@/components/sections/Steps";
import { ValueStack } from "@/components/sections/ValueStack";
import { WhoFor } from "@/components/sections/WhoFor";
import { StickyBar } from "@/components/StickyBar";

export default function Page() {
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
