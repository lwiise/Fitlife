"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import { openCommandPalette } from "./events";

function noopSubscribe() {
  return () => {};
}

function isApplePlatform(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere (server render assumes ⌘). */
function useShortcutLabel(): string {
  const apple = useSyncExternalStore(noopSubscribe, isApplePlatform, () => true);
  return apple ? "⌘K" : "Ctrl K";
}

/**
 * Opens the command palette. `bar` is the wide top-bar field (≥1024px),
 * `icon` the phone icon button. The palette itself listens for the event, so
 * this stays tiny and works before the family index has loaded.
 */
export function PaletteTrigger({
  variant,
  label,
  placeholder,
  className,
}: {
  variant: "bar" | "icon";
  /** Accessible name. */
  label: string;
  /** Visible text of the bar variant. */
  placeholder?: string;
  className?: string;
}) {
  const shortcut = useShortcutLabel();
  if (variant === "icon") {
    return (
      <button
        type="button"
        className={clsx("ad-iconbtn", className)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={openCommandPalette}
      >
        <Search className="ad-ic" aria-hidden="true" />
      </button>
    );
  }
  return (
    <button
      type="button"
      className={clsx("ad-search ad-top-search", className)}
      aria-label={label}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      onClick={openCommandPalette}
    >
      <Search className="ad-ic" aria-hidden="true" />
      <span aria-hidden="true">{placeholder ?? label}</span>
      <kbd className="ad-kbd" aria-hidden="true" dir="ltr">
        {shortcut}
      </kbd>
    </button>
  );
}
