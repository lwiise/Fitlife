import Hero from "@/components/sections/Hero";
import Problem from "@/components/sections/Problem";
import BrandSwatches from "@/components/sections/BrandSwatches";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        تخطّ إلى المحتوى
      </a>
      <main id="main" className="flex flex-1 flex-col">
        {/* TEMPORARY — delete after design-system sign-off */}
        <BrandSwatches />
        <Hero />
        <Problem />
      </main>
    </>
  );
}
