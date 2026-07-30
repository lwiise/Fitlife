import { ShimmerButton } from "@/marketing/bundle/ui/shimmer-button";
import { SALLA, whatsappOrderUrl } from "@/marketing/bundle/config";
import { cn } from "@/marketing/lib/utils";

// The purchase control: a plain link to the store's own Salla product page,
// where Salla runs its own checkout (Apple Pay / mada / Visa / Tabby).
//
// This deliberately replaced Salla's embedded fast-checkout widget, which
// cannot work on a non-Salla domain — see the note in config.ts. A link is
// also the most robust thing a buy button can be: no third-party script on the
// critical path, so it cannot break at runtime or fail to load.
type CheckoutButtonProps = {
  label: string;
  className?: string;
};

export function CheckoutButton({ label, className }: CheckoutButtonProps) {
  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      <ShimmerButton href={SALLA.productUrl} className="w-full px-10 py-4 text-lg">
        {label}
      </ShimmerButton>
      {/* Quiet second door for anyone who'd rather order by message. */}
      <a
        href={whatsappOrderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 items-center justify-center text-sm font-medium text-current opacity-70 underline underline-offset-4 transition-opacity hover:opacity-100 motion-reduce:transition-none"
      >
        أو اطلبي عبر واتساب
      </a>
    </div>
  );
}
