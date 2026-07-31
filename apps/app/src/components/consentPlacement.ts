// Placement rules for the analytics consent ask.
//
// Extracted out of the component on purpose: this is the part of the fix that
// must never silently regress, and app tests run in a NODE environment with no
// renderer (vitest.config.ts), so the invariant is only testable if it lives in
// plain values and pure functions rather than in JSX.
//
// WHY it needs guarding at all — the ask has now been rebuilt three times:
//   1. a Radix Sheet (modal: focus trap + `pointer-events: none` on the body)
//      which froze the onboarding wizard until answered;
//   2. a non-modal `fixed inset-x-0 bottom-0 z-50` bar, which stopped freezing
//      anything but still COVERED the bottom band of the viewport at every
//      scroll offset — exactly where this app's primary control always sits
//      («التالي» on every wizard step, the check-in chips on /plan, the pricing
//      CTAs on `/`);
//   3. `document.body.style.paddingBottom` on top of (2), which lengthens the
//      DOCUMENT and therefore only clears the bar at MAXIMUM scroll.
// The conclusion of (2)+(3) is that no geometry tuning can fix an overlay: a bar
// of height h covers h pixels of viewport, wherever the user has scrolled to. So
// the ask now owns NO positioning at all and lives in normal document flow —
// which cannot cover anything, on any page, including pages not written yet.

/** aria-label of the ask. Shared so tests and QA scripts target one string. */
export const CONSENT_ASK_LABEL = "إعدادات القياس والخصوصية";

/**
 * The ask's own classes. Colour, spacing and borders only — deliberately no
 * `fixed`/`sticky`/`absolute`, no `inset-*`, no `z-*`. Placement belongs to the
 * host slot, never to the ask itself.
 */
export const CONSENT_ASK_CLASS = "border-b border-ink/10 bg-surface-elevated";

/** Positioning that would take an element back out of normal document flow. */
const OUT_OF_FLOW_POSITIONS = ["fixed", "sticky", "absolute"];

/**
 * True when a Tailwind class string would put the element in the overlay layer.
 * Variant prefixes are stripped first, so `sm:fixed` counts exactly like
 * `fixed` — a bar that only overlays on small screens is still the bug, and
 * mobile is 70% of this audience (CLAUDE.md).
 */
export function hasOutOfFlowPositioning(className: string): boolean {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => OUT_OF_FLOW_POSITIONS.includes(token.split(":").pop() ?? ""));
}

/**
 * Routes the app-wide slot may render the ask on — an ALLOWLIST, not a denylist.
 *
 * It started as "everywhere except routes that place it themselves", and that
 * default is what an adversarial review took apart. Three ways it fails, all of
 * which are properties of the ROUTE, not of the ask:
 *
 * 1. LAYOUT SHIFT MID-TASK. The ask is in flow and mounts at hydration, so the
 *    whole document below it moves down by its height. On a form the user is
 *    already reaching for, that relocates the control under a descending finger
 *    — the same mis-tap the `fixed bottom-0` bar caused, just applied to every
 *    control instead of the bottom band.
 * 2. IT GETS OCCLUDED. OnboardingFamilyBuilder and FamilyAddBuilder render
 *    `fixed inset-0 z-50` in every phase, so an in-flow block at the top of the
 *    document is 100% covered: present in the DOM, invisible and unclickable.
 *    Consent is then uncollectable on exactly those routes while looking fine.
 * 3. IT PRINTS. /plan/housekeeper is printed for the person cooking; a consent
 *    block would lead page 1.
 *
 * So the ask appears only where the user is NOT mid-task and nothing covers it:
 * the dashboard (every account lands there, its header is in-flow `sticky`) and
 * the landing page, which places it in its own flow below the hero. Anywhere
 * else it stays silent — and because tracking is opt-in, silence costs
 * measurement, never correctness.
 */
export const CONSENT_APP_SLOT_ROUTES = ["/dashboard"] as const;

/**
 * Routes that place the ask inside their OWN flow and therefore must not also
 * get the app-wide slot. `/` is the landing page: its header is
 * `fixed inset-x-0 top-0` and transparent over the hero, so a block at the very
 * top of the document would sit under the logo.
 */
export const CONSENT_SELF_PLACED_ROUTES = ["/"] as const;

/** Trailing slashes are equivalent routes; `/` itself must stay `/`. */
function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Whether the app-wide slot should render the ask on this route. */
export function shouldRenderConsentInAppSlot(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  const path = normalizePath(pathname);
  if ((CONSENT_SELF_PLACED_ROUTES as readonly string[]).includes(path)) return false;
  return (CONSENT_APP_SLOT_ROUTES as readonly string[]).includes(path);
}

/**
 * Measurement is on only when it was explicitly accepted: to the user "unset"
 * and "declined" are the same fact — nothing is being measured — so /settings
 * must describe them identically rather than exposing a third state.
 */
export function isMeasurementOn(consent: string): boolean {
  return consent === "accepted";
}
