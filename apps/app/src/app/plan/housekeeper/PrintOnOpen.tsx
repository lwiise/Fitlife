"use client";

import { useEffect } from "react";

/** «اطبعيها» on the home ticket opens this page with ?print=1: once the
 * cook's week has rendered, open the browser's print dialog, once. */
export function PrintOnOpen() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
