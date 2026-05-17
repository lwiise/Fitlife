"use client";

import { ChevronDown, Globe } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FooterLink = { href: string; label: string };

const productLinks: FooterLink[] = [
  { href: "#features", label: "الميزات" },
  { href: "#pricing", label: "الأسعار" },
  { href: "#pricing", label: "الباقات" },
  { href: "#", label: "التطبيق" },
];

const companyLinks: FooterLink[] = [
  { href: "/about", label: "عن فت لايف" },
  { href: "#trust", label: "ساره العتيبي (الخبيرة)" },
  { href: "/contact", label: "تواصل معنا" },
  { href: "/careers", label: "وظائف" },
];

const legalLinks: FooterLink[] = [
  { href: "/privacy", label: "سياسة الخصوصية" },
  { href: "/terms", label: "شروط الاستخدام" },
  { href: "/refunds", label: "سياسة الاسترداد" },
];

const socialLinks = [
  {
    href: "https://snapchat.com/add/fitlife",
    label: "فت لايف على سناب شات",
    Icon: SnapchatIcon,
  },
  {
    href: "https://tiktok.com/@fitlife",
    label: "فت لايف على تيك توك",
    Icon: TikTokIcon,
  },
  {
    href: "https://instagram.com/fitlife.app",
    label: "فت لايف على إنستغرام",
    Icon: InstagramIcon,
  },
  {
    href: "https://x.com/fitlife_app",
    label: "فت لايف على إكس",
    Icon: XIcon,
  },
];

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12.166 2.001c-2.687.012-5.18 1.477-6.515 3.831-.504.888-.71 1.918-.611 2.938.075.769.075 1.541-.001 2.31-.05.499-.272.967-.628 1.32-.355.353-.821.572-1.32.622-.282.027-.5.265-.5.55v.198c0 .227.149.428.366.494.65.197 1.302.392 1.952.587.215.064.391.224.473.43.082.207.062.439-.054.628-.286.467-.55.948-.788 1.44-.107.222-.066.487.103.668.169.18.428.243.654.157 1.27-.485 2.633-.682 3.988-.577.249.019.466.183.554.418.291.776.806 1.453 1.481 1.94 1.044.752 2.405.951 3.604.526 1.155-.409 2.082-1.286 2.563-2.427.083-.197.27-.331.482-.348 1.36-.108 2.728.087 4.002.573.226.086.485.024.654-.156.169-.181.211-.446.103-.668-.238-.492-.502-.973-.788-1.44-.116-.189-.137-.421-.054-.628.082-.206.258-.366.473-.43.65-.195 1.302-.39 1.952-.587.218-.066.366-.267.366-.494v-.198c0-.285-.218-.523-.5-.55-.498-.05-.964-.269-1.32-.622-.355-.353-.578-.821-.628-1.32-.075-.769-.076-1.541-.001-2.31.099-1.02-.107-2.05-.611-2.938C17.345 3.478 14.853 2.013 12.166 2.001z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FooterAnchor({ href, label }: FooterLink) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="text-sm text-[#D9B0FC]/70 transition-colors duration-150 hover:text-white"
    >
      {label}
    </a>
  );
}

function LinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul className="space-y-3">
      {links.map((link, i) => (
        <li key={i}>
          <FooterAnchor {...link} />
        </li>
      ))}
    </ul>
  );
}

function BrandColumn() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-2xl font-extrabold text-brand-yellow">
          فت لايف 2.0
        </span>
      </div>
      <p className="max-w-xs text-sm leading-relaxed text-[#D9B0FC]/70">
        تغذية ذكية لكل البيت الخليجي.
      </p>
      <ul className="flex flex-row items-center gap-3">
        {socialLinks.map(({ href, label, Icon }, i) => (
          <li key={i}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[#D9B0FC] transition-all duration-200 hover:bg-brand-yellow/15 hover:text-brand-yellow"
            >
              <Icon />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-brand-yellow">{children}</h3>
  );
}

function LanguageSwitcher() {
  return (
    // TODO: Wire up i18n routing in Phase 4. Currently UI-only.
    <button
      type="button"
      aria-label="تغيير اللغة"
      className="flex items-center gap-2 text-sm text-[#D9B0FC]/60 transition-colors hover:text-white"
    >
      <Globe className="size-4" aria-hidden="true" />
      <span>العربية</span>
      <ChevronDown className="size-4" aria-hidden="true" />
    </button>
  );
}

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      aria-label="تذييل الموقع"
      className="bg-ink pb-8 pt-20 text-white"
    >
      <div className="container-page">
        <div className="hidden md:grid md:grid-cols-12 md:gap-12">
          <div className="md:col-span-6 lg:col-span-4">
            <BrandColumn />
          </div>
          <div className="md:col-span-3 lg:col-span-2">
            <div className="space-y-4">
              <ColumnHeading>المنتج</ColumnHeading>
              <LinkList links={productLinks} />
            </div>
          </div>
          <div className="md:col-span-3 lg:col-span-2">
            <div className="space-y-4">
              <ColumnHeading>الشركة</ColumnHeading>
              <LinkList links={companyLinks} />
            </div>
          </div>
          <div className="md:col-span-6 lg:col-span-4">
            <div className="space-y-4">
              <ColumnHeading>قانوني</ColumnHeading>
              <LinkList links={legalLinks} />
              <div className="space-y-1 pt-2 text-xs font-medium text-[#D9B0FC]/50">
                <p>سجل تجاري: 1010XXXXXX</p>
                <p>الرقم الضريبي: 30XXXXXXXX003</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 md:hidden">
          <BrandColumn />

          <Accordion type="multiple" className="w-full">
            <AccordionItem
              value="product"
              className="border-b border-white/10"
            >
              <AccordionTrigger className="py-4 text-sm font-bold text-brand-yellow no-underline hover:no-underline [&_[data-slot=accordion-trigger-icon]]:text-[#D9B0FC]/70">
                المنتج
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <LinkList links={productLinks} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem
              value="company"
              className="border-b border-white/10"
            >
              <AccordionTrigger className="py-4 text-sm font-bold text-brand-yellow no-underline hover:no-underline [&_[data-slot=accordion-trigger-icon]]:text-[#D9B0FC]/70">
                الشركة
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <LinkList links={companyLinks} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="legal">
              <AccordionTrigger className="py-4 text-sm font-bold text-brand-yellow no-underline hover:no-underline [&_[data-slot=accordion-trigger-icon]]:text-[#D9B0FC]/70">
                قانوني
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <div className="space-y-4">
                  <LinkList links={legalLinks} />
                  <div className="space-y-1 text-xs font-medium text-[#D9B0FC]/50">
                    <p>سجل تجاري: 1010XXXXXX</p>
                    <p>الرقم الضريبي: 30XXXXXXXX003</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-[#D9B0FC]/60">
              © 2026 فت لايف. جميع الحقوق محفوظة. صُنع في المملكة العربية السعودية ❤️
            </p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
