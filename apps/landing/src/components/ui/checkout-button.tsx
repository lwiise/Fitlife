import { ShimmerButton } from "@/components/ui/shimmer-button";
import { SALLA, whatsappOrderUrl } from "@/lib/config";
import { cn } from "@/lib/utils";

// The purchase control. Renders Salla's fast-checkout widget, which opens the
// hosted payment modal (Apple Pay / mada / Visa / Tabby) over this page, so
// the shopper never leaves the offer.
//
// The widget is a custom element from a third-party CDN, and a custom element
// whose script never loads renders NOTHING (verified: 0×0, no children). So a
// fallback ships alongside it and CSS picks the visible one: `:not(:defined)`
// matches only while the element is un-upgraded, so the fallback appears
// exactly when the widget cannot. Rules live in globals.css (.salla-slot).
// Width comes from the caller's className (w-full / w-fit) — both the widget
// and the fallback stretch to the slot, so they can never differ in size.
type CheckoutButtonProps = {
  label: string;
  className?: string;
};

export function CheckoutButton({ label, className }: CheckoutButtonProps) {
  return (
    <div className={cn("salla-slot", className)}>
      <salla-mini-checkout-widget
        store-id={SALLA.storeId}
        products={SALLA.products}
        language={SALLA.language}
        label={label}
      />
      <ShimmerButton
        href={SALLA.productUrl || whatsappOrderUrl}
        {...(SALLA.productUrl
          ? {}
          : { target: "_blank", rel: "noopener noreferrer" })}
        className="salla-fallback px-10 py-4 text-lg"
      >
        {label}
      </ShimmerButton>
    </div>
  );
}
