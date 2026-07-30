// Fit Life's social profiles — the same four the main site's footer links to,
// kept in one place so the offer page can't drift from the brand's accounts.
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

const SOCIAL_LINKS = [
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
