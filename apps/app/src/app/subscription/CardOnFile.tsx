import { getLSSubscription } from "@/lib/lemonsqueezy/subscription";

/**
 * Card on file, streamed from LS (async). Renders nothing if LS is unavailable
 * or no card is present. Last-4 + brand are safe to show (not PCI-protected).
 */
export async function CardOnFile({ subId }: { subId: string }) {
  const details = await getLSSubscription(subId);
  if (!details?.card_last_four) return null;

  return (
    <p className="mt-1 text-brand-ink-muted text-sm leading-relaxed">
      البطاقة: •••• {details.card_last_four}
      {details.card_brand ? ` (${details.card_brand})` : ""}
    </p>
  );
}
