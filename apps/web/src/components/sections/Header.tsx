"use client";

import { Menu } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import { useEffect, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

type NavLink = { href: string; id: string; label: string };

const navLinks: NavLink[] = [
  { href: "#features", id: "features", label: "الميزات" },
  { href: "#pricing", id: "pricing", label: "الأسعار" },
  { href: "#trust", id: "trust", label: "عن المنتج" },
  { href: "#faq", id: "faq", label: "الأسئلة" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 100);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observers: IntersectionObserver[] = [];
    const sectionIds = ["features", "pricing", "trust", "faq"];

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(id);
            }
          });
        },
        { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" },
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 py-4 transition-all duration-300 ease-out motion-reduce:transition-none",
          scrolled
            ? "bg-surface shadow-md backdrop-blur-md"
            : "bg-transparent",
        )}
      >
        <div className="container-page flex flex-row items-center justify-between gap-4">
          <a
            href="#"
            className="inline-flex items-center"
            aria-label="فت لايف — العودة إلى الأعلى"
          >
            <Logo priority className="h-11 w-auto" />
          </a>

          <nav className="hidden flex-row items-center gap-8 lg:flex">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  className={cn(
                    "relative rounded-sm px-1 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isActive ? "text-primary" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="activeNavUnderline"
                      className="absolute inset-x-0 -bottom-1 h-0.5 bg-brand-yellow"
                      aria-hidden="true"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="flex flex-row items-center gap-2">
            <a
              href="#pricing"
              className="hidden min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-purple-700 lg:inline-flex"
            >
              ابدئي مجاناً
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-ink hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="size-6" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="bg-surface p-6">
          <SheetHeader className="p-0">
            <SheetTitle className="text-start">
              <Logo className="h-9 w-auto" />
            </SheetTitle>
          </SheetHeader>

          <nav className="mt-8 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-4 py-3 text-start text-lg font-medium text-ink transition-colors hover:bg-ink/5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 border-t border-ink/10 pt-6">
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-lg bg-primary px-5 py-3 text-center text-base font-bold text-white"
            >
              ابدئي مجاناً
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
