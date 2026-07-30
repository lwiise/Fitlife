import Image from "next/image";

// Fit Life brand logo. Source is 600×660 (transparent PNG); size via the
// `className` height (w-auto keeps the aspect ratio). The wordmark is deep
// purple — built for light backgrounds; invert it for dark surfaces.
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
