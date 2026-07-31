// Fit Life's social profiles for the offer page: TikTok and Instagram only,
// both @fitlife.well (owner directive 07/2026). The Snapchat and X links that
// used to sit here pointed at placeholder handles and are gone — this page now
// links only to accounts that exist. Note this deliberately no longer mirrors
// the main site's footer, which still carries its own four.
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

// The handle rides in each label, not just the platform name: a screen-reader
// user who hears only "تيك توك" has no way to tell which account it opens.
const SOCIAL_LINKS = [
  {
    href: "https://www.tiktok.com/@fitlife.well",
    label: "فت لايف على تيك توك — fitlife.well",
    Icon: TikTokIcon,
  },
  {
    href: "https://www.instagram.com/fitlife.well/",
    label: "فت لايف على إنستغرام — fitlife.well",
    Icon: InstagramIcon,
  },
] as const;

export function SocialLinks() {
  return (
    <ul className="flex items-center gap-2">
      {SOCIAL_LINKS.map(({ href, label, Icon }) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="lift inline-flex size-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );
}
