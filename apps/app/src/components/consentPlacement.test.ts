import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CONSENT_ASK_CLASS,
  CONSENT_ASK_LABEL,
  hasOutOfFlowPositioning,
  isMeasurementOn,
  shouldRenderConsentInAppSlot,
} from "./consentPlacement";

// The consent ask covered every primary CTA in this app for as long as it lived
// in the overlay layer — «التالي» on the mom wizard was reported by production QA
// as visible, enabled and stable while the click was intercepted by
// "<section aria-label='إعدادات القياس والخصوصية'>". Two earlier shapes failed
// (modal Sheet → froze the wizard; `fixed bottom-0` bar + body padding → cleared
// the CTA only at maximum scroll), so this locks the third: the ask owns no
// positioning and is mounted in flow.
//
// Nothing renders here (vitest environment is "node", see vitest.config.ts), so
// the invariant is asserted against the extracted pure module plus the two source
// files whose shape carries it.
const app = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const consentSource = app("src/components/CookieConsent.tsx");
const layoutSource = app("src/app/layout.tsx");

/**
 * Scan CODE, not prose. The component's header comment deliberately spells out
 * the two failed shapes — `fixed bottom-0`, `pointer-events: none`,
 * `document.body.style.paddingBottom` — so that history is not lost, and a
 * whole-file regex would read those words as the bug itself.
 */
const codeOf = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
const consentCode = codeOf(consentSource);

describe("consent ask placement", () => {
  it("detects the overlay positioning that broke the last two attempts", () => {
    // The exact class string shipped by attempt 2 — the detector is worthless if
    // it does not flag it, and `sm:fixed` must count too (mobile is 70% of users).
    expect(hasOutOfFlowPositioning("fixed inset-x-0 bottom-0 z-50 p-3")).toBe(true);
    expect(hasOutOfFlowPositioning("sticky top-0 z-10")).toBe(true);
    expect(hasOutOfFlowPositioning("sm:fixed bottom-0")).toBe(true);
    expect(hasOutOfFlowPositioning("border-b border-ink/10 bg-surface-elevated")).toBe(
      false,
    );
  });

  it("gives the ask no positioning of its own", () => {
    expect(hasOutOfFlowPositioning(CONSENT_ASK_CLASS)).toBe(false);
    // z-index and viewport anchoring only ever exist to sit ON TOP of content.
    expect(CONSENT_ASK_CLASS).not.toMatch(/\b(z-|inset-|bottom-|top-)/);
  });

  it("renders that class rather than positioning itself inline", () => {
    expect(consentCode).toContain("className={CONSENT_ASK_CLASS}");
    for (const cls of consentCode.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g) ?? []) {
      expect(hasOutOfFlowPositioning(cls)).toBe(false);
    }
  });

  it("never reserves space on the body (that only clears at max scroll)", () => {
    expect(consentCode).not.toMatch(/body\.style\.padding/);
  });

  it("stays non-modal: no focus trap and no body pointer-events lock", () => {
    expect(consentCode).not.toMatch(/aria-modal|role="dialog"|<Sheet|inert/);
    expect(consentCode).not.toMatch(/pointer-events/);
  });

  it("is mounted AFTER {children}, so nothing above it can shift when it mounts", () => {
    // Position is load-bearing, not cosmetic. In flow at the TOP of <body> the
    // ask pushed the whole page down when it mounted at hydration, moving a
    // control out from under a finger already descending on it — the same
    // mis-tap the `fixed bottom-0` bar caused, spread over every control instead
    // of the bottom band. Last in the document, nothing above it can move.
    const slot = layoutSource.indexOf("<ConsentSlot />");
    expect(slot).toBeGreaterThan(-1);
    expect(slot).toBeGreaterThan(layoutSource.indexOf("{children}"));
  });

  it("asks only where the user is not mid-task and nothing can cover it", () => {
    // The dashboard is the one in-app route that qualifies: every account lands
    // there, its header is in-flow `sticky`, and arriving is not mid-task.
    expect(shouldRenderConsentInAppSlot("/dashboard")).toBe(true);
    expect(shouldRenderConsentInAppSlot("/dashboard/")).toBe(true);

    // The landing page places it at the end of its own flow — its header is
    // `fixed top-0` and transparent, so the top of the document is covered.
    expect(shouldRenderConsentInAppSlot("/")).toBe(false);
    expect(shouldRenderConsentInAppSlot("//")).toBe(false);

    // Everything else stays silent, and each of these is a DIFFERENT reason —
    // this is the assertion that would have caught the allowlist being an
    // afterthought:
    for (const path of [
      // in-flow ask mounting at hydration shifts a form the user is already
      // reaching for — the mis-tap, moved from the bottom band to every control
      "/onboarding/mom",
      "/onboarding/workout",
      "/auth/signup",
      // OnboardingFamilyBuilder / FamilyAddBuilder render `fixed inset-0 z-50`
      // in every phase, so an in-flow block is 100% occluded: consent would be
      // uncollectable here while the DOM says it is present
      "/onboarding/members",
      "/family/add",
      // printed for the person cooking; a consent block would lead page 1
      "/plan/housekeeper",
      // /settings has its own «القياس والتحسين» card — asking twice on one
      // screen, with no shared state, contradicts itself
      "/settings",
    ]) {
      expect(shouldRenderConsentInAppSlot(path)).toBe(false);
    }

    // usePathname can be null during a transition. Silence is the safe side now:
    // rendering into an unknown route is what put the ask under a fixed overlay.
    expect(shouldRenderConsentInAppSlot(null)).toBe(false);
  });

  it("treats an unanswered choice as measurement off", () => {
    expect(isMeasurementOn("accepted")).toBe(true);
    expect(isMeasurementOn("declined")).toBe(false);
    expect(isMeasurementOn("unset")).toBe(false);
  });

  it("keeps one aria-label so QA scripts and the component cannot drift", () => {
    expect(CONSENT_ASK_LABEL).toBe("إعدادات القياس والخصوصية");
    expect(consentSource).toContain("aria-label={CONSENT_ASK_LABEL}");
  });
});
