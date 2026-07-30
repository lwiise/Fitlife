// Salla's fast-checkout web components are defined by a third-party module at
// runtime; React 19 passes unknown attributes straight through to the DOM, so
// they only need JSX typings.
import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "salla-mini-checkout-widget": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "store-id"?: string;
        products?: string;
        language?: string;
        label?: string;
      };
    }
  }
}
