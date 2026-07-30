"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";

// Radix primitives default to LTR internally regardless of the html dir
// attribute — this provider is load-bearing for the accordion's chevron and
// keyboard behaviour on an RTL page.
export function DirProvider({ children }: { children: ReactNode }) {
  return <Direction.Provider dir="rtl">{children}</Direction.Provider>;
}
