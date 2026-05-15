import Hero from "@/components/sections/Hero";
import Problem from "@/components/sections/Problem";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Problem />
    </main>
  );
}
