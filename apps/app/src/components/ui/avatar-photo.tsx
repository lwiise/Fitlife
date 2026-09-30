"use client";

import { useEffect, useRef } from "react";

/**
 * A person's profile photo, laid over their initial (lib/profilePhoto). The
 * initial underneath is the fallback while the photo loads and whenever it
 * cannot load — a photo removed from another tab, an expired session. That
 * needs this small client island: browsers draw a broken-image glyph for a
 * sized <img> even with an empty alt (verified in Chromium), so a failed
 * photo hides itself. `hidden` is toggled on the element rather than kept in
 * state, and an error that happened before hydration — which React never
 * sees as an event — is caught on mount.
 *
 * A plain <img> on purpose: these are private per-account photos served by
 * /api/profile-photo with a private, immutable cache header, and the
 * next/image optimizer would copy them into its shared server cache.
 */
export function AvatarPhoto({ src, px }: { src: string; px: number }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) img.hidden = true;
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- private photo, see above
    <img
      ref={ref}
      src={src}
      alt=""
      width={px}
      height={px}
      decoding="async"
      draggable={false}
      onError={(e) => {
        e.currentTarget.hidden = true;
      }}
      onLoad={(e) => {
        e.currentTarget.hidden = false;
      }}
      className="absolute inset-0 size-full rounded-full object-cover"
    />
  );
}
