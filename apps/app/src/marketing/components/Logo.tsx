import Image from "next/image";

// Fit Life brand logo. Source is 2463×2709 (transparent PNG); size via the
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
      width={2463}
      height={2709}
      priority={priority}
      className={className}
    />
  );
}
