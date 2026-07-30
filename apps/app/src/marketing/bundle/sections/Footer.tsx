import { WhatsAppIcon } from "@/marketing/bundle/WhatsAppIcon";
import { whatsappUrl } from "@/marketing/bundle/config";

// lucide dropped brand glyphs — these are deliberate placeholders (checklist:
// point the hrefs at the real profiles or swap in official assets).
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.5" fill="currentColor" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="5" rx="4" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { label: "إنستغرام فت لايف", icon: InstagramIcon, href: "#" },
  { label: "يوتيوب فت لايف", icon: YoutubeIcon, href: "#" },
  { label: "حساب فت لايف على منصة إكس", icon: XIcon, href: "#" },
] as const;

export function Footer() {
  return (
    // Extra bottom padding on mobile keeps content clear of the sticky bar.
    <footer className="bg-brand-purple-950 pb-28 text-white md:pb-10">
      <div className="container-page flex flex-col items-start gap-6 pt-10 md:flex-row md:items-center md:justify-between">
        <p className="text-lg font-extrabold">
          Fit Life <span className="font-normal text-white/60">© 2026</span>
        </p>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-medium text-white/85 transition-colors hover:text-white focus-visible:outline-white"
        >
          <WhatsAppIcon className="text-whatsapp size-5" />
          واتساب
        </a>

        <ul className="flex items-center gap-2">
          {SOCIAL_LINKS.map((social) => (
            <li key={social.label}>
              <a
                href={social.href}
                aria-label={social.label}
                className="inline-flex size-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
              >
                <social.icon className="size-5" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
