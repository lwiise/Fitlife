import Image from "next/image";

// Fit Life brand logo, for light backgrounds (the wordmark is deep purple).
// Size via the `className` height; w-auto keeps the aspect ratio.
//   full    — /logo.png, 600×660, carries ~40% transparent padding around the
//             mark. Kept for the surfaces laid out around that padding.
//   compact — /logo-compact.png, the same art cropped to its content
//             (520×428), so a 40px-tall header logo is 40px of logo.
const SOURCES = {
  full: { src: "/logo.png", width: 600, height: 660 },
  compact: { src: "/logo-compact.png", width: 520, height: 428 },
} as const;

export function Logo({
  className = "h-10 w-auto",
  priority = false,
  variant = "full",
}: {
  className?: string;
  priority?: boolean;
  variant?: keyof typeof SOURCES;
}) {
  const s = SOURCES[variant];
  return (
    <Image
      src={s.src}
      alt="فت لايف"
      width={s.width}
      height={s.height}
      priority={priority}
      className={className}
    />
  );
}
