import { Header } from "@/components/sections/Header";
import { Hero } from "@/components/sections/Hero";
import { StickyBar } from "@/components/StickyBar";

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
      </main>
      <StickyBar />
    </>
  );
}
