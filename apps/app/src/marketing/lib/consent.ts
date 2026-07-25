/**
 * Cookie-consent state for the marketing pages.
 *
 * The banner and the analytics provider both need this value, and they used to
 * keep separate ideas of it: the provider initialized PostHog on mount, so a
 * pageview was captured before the banner appeared and «رفض» changed nothing
 * but a localStorage key. One module so the two cannot drift again.
 */
const CONSENT_KEY = "fitlife_cookie_consent";

export type ConsentState = "accepted" | "declined" | null;

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    return stored === "accepted" || stored === "declined" ? stored : null;
  } catch {
    // Private mode / storage disabled — treat as undecided, never as consent.
    return null;
  }
}

export function writeConsent(value: Exclude<ConsentState, null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Nothing to do — the banner still applies the choice for this session.
  }
}
