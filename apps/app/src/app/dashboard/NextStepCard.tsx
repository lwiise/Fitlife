"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/**
 * The ONE suggestion the home screen makes (09/2026 redesign) — replaces the
 * three stacked nudge banners (add family, workout, deep-dive). The server
 * picks which by priority; hiding it lasts for the browser session, keyed per
 * suggestion so dismissing one lets the next through on a later visit.
 */
export function NextStepCard({
  id,
  title,
  body,
  href,
  cta,
}: {
  id: "family" | "workout" | "deep-dive";
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  const key = `fitlife.nextStep.${id}.dismissed`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hidden = false;
    try {
      hidden = sessionStorage.getItem(key) === "1";
    } catch {
      /* storage blocked: show it */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only sessionStorage read; no render loop
    if (!hidden) setVisible(true);
  }, [key]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: hide for this render only */
    }
    setVisible(false);
  };

  return (
    <aside
      aria-labelledby="next-step-title"
      className="relative rounded-[1.375rem] border border-dashed border-brand-purple-900/30 bg-brand-card p-4 pe-14 sm:p-5 sm:pe-16"
    >
      <p className="text-meta font-bold text-brand-purple-900">خطوة تالية</p>
      <h2 id="next-step-title" className="mt-1 text-app-item text-brand-ink">
        {title}
      </h2>
      <p className="mt-1 text-base leading-relaxed text-brand-ink-muted">{body}</p>
      <Link href={href} className={buttonClasses({ variant: "secondary", className: "mt-3" })}>
        {cta}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="إخفاء الاقتراح"
        className="absolute end-2 top-2 grid size-11 place-items-center rounded-full text-brand-ink-muted hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
