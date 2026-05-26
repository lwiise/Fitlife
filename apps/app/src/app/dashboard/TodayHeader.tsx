"use client";

import { useEffect, useState } from "react";
import { formatTodayHeader } from "@/lib/plans/dayMapping";

/**
 * Device-date "today" label. Computed after mount so it reflects the user's
 * device (Saudi UTC+3), not the UTC server clock — and to avoid a hydration
 * mismatch between server and client renders.
 */
export function TodayHeader() {
  const [label, setLabel] = useState("");
  useEffect(() => setLabel(formatTodayHeader()), []);
  return (
    <p className="font-extrabold text-2xl md:text-3xl text-brand-ink leading-tight">
      {label || " "}
    </p>
  );
}
