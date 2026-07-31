import { ShimmerButton } from "@/components/ui/shimmer-button";
import { SALLA } from "@/lib/config";
import { cn } from "@/lib/utils";

// The purchase control: a plain link to the store's own Salla payment link,
// where Salla runs its own checkout (Apple Pay / mada / Visa / Tabby).
//
// This deliberately replaced Salla's embedded fast-checkout widget, which
// cannot work on a non-Salla domain — see the note in config.ts. A link is
// also the most robust thing a buy button can be: no third-party script on the
// critical path, so it cannot break at runtime or fail to load.
//
// One door only. There used to be a quiet "أو اطلبي عبر واتساب" link under it;
// it was removed on the owner's call, so every purchase point now leads to the
// same place. WhatsApp still appears where it belongs — Steps, for sending the
// invoice after buying, and the footer.
type CheckoutButtonProps = {
  label: string;
  className?: string;
};

export function CheckoutButton({ label, className }: CheckoutButtonProps) {
  return (
    <ShimmerButton
      href={SALLA.productUrl}
      className={cn("px-10 py-4 text-lg", className)}
    >
      {label}
    </ShimmerButton>
  );
}
