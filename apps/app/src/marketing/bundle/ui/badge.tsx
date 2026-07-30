import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/marketing/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-xs font-bold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-brand-purple-900 text-white",
        // Gold FILL with ink text (≈7.8:1) — never gold text on light surfaces.
        gold: "bg-gold-500 text-brand-ink",
        soft: "bg-brand-purple-100 text-brand-purple-700",
        outline: "border-border bg-surface-elevated text-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
