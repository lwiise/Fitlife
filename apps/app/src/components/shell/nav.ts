/**
 * The app's five destinations (owner decision 09/2026). One list drives the
 * phone tab bar and the desktop header nav, so the two can never disagree.
 * `match` lists every path prefix that belongs to a tab — /journey and
 * /subscription live under «حسابي», the plan history under «الخطة».
 */
export type NavKey = "home" | "plan" | "chat" | "family" | "account";

export const NAV_ITEMS: ReadonlyArray<{
  key: NavKey;
  href: string;
  label: string;
  match: readonly string[];
}> = [
  { key: "home", href: "/dashboard", label: "الرئيسية", match: ["/dashboard", "/recap"] },
  { key: "plan", href: "/plan", label: "الخطة", match: ["/plan"] },
  { key: "chat", href: "/chat", label: "المستشارة", match: ["/chat"] },
  { key: "family", href: "/family", label: "العائلة", match: ["/family"] },
  {
    key: "account",
    href: "/settings",
    label: "حسابي",
    match: ["/settings", "/profile", "/subscription", "/journey"],
  },
];

/** Which tab owns this path (null = none, e.g. a focus flow). */
export function activeNavKey(pathname: string): NavKey | null {
  for (const item of NAV_ITEMS) {
    if (item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))) {
      return item.key;
    }
  }
  return null;
}

/**
 * Focus flows render WITHOUT the shell: a step-by-step wizard (leaving it
 * mid-way loses unsaved members) and the cook's translated view (a different
 * reader, a different language — the owner's tabs mean nothing to her).
 */
export const FOCUS_PREFIXES: readonly string[] = ["/family/add", "/plan/housekeeper"];

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
