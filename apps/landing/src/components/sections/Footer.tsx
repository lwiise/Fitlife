import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { SocialLinks } from "@/components/SocialLinks";
import { Logo } from "@/components/Logo";
import { whatsappUrl } from "@/lib/config";

export function Footer() {
  return (
    // Continues the finale's night surface; the hairline separates the two.
    // Extra bottom padding on mobile keeps content clear of the sticky bar.
    <footer className="border-t border-white/10 bg-brand-purple-950 pb-28 text-white md:pb-10">
      <div className="container-page flex flex-col items-start gap-6 pt-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {/* The wordmark is deep purple for light backgrounds — invert it to
              white so it reads on the night surface. */}
          <Logo className="h-11 w-auto brightness-0 invert" />
          <span className="text-sm text-white/60">© 2026</span>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-white/85 transition-colors hover:text-white focus-visible:outline-white"
        >
          <WhatsAppIcon className="text-whatsapp size-5" />
          واتساب
        </a>

        <SocialLinks />
      </div>
    </footer>
  );
}
