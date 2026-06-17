import Image from "next/image";

// Fit Life brand logo. Source is 600×660 (transparent PNG, downscaled from the
// original 2463×2709 — it never renders larger than ~40px tall); size via the
// `className` height (w-auto keeps the aspect ratio). Intended for light
// backgrounds — the wordmark is deep purple.
export function Logo({
  className = "h-10 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="فت لايف"
      width={600}
      height={660}
      priority={priority}
      className={className}
    />
  );
}
