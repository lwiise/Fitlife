/**
 * Pure logic for the full family page and its three audited views (plan,
 * program, health). No React, no I/O, no clock — client-safe, so the danger
 * zone and the tab bar import it too, and the server actions share its rules
 * (the typed-email comparison, where the account tools return and why).
 */

import { FAMILY_TABS, type FamilyTab } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t, type AdminStringKey } from "@/lib/admin/i18n";

// ── URL state ───────────────────────────────────────────────────────────────

/** A search param's single value (Next hands repeated params as an array). */
export function firstParam(value: string | readonly string[] | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "string" ? value : value[0];
}

/** `?tab=`, validated against FAMILY_TABS; anything else is the summary. */
export function parseFamilyTab(value: string | readonly string[] | null | undefined): FamilyTab {
  const tab = firstParam(value);
  return (FAMILY_TABS as readonly string[]).includes(tab ?? "") ? (tab as FamilyTab) : "summary";
}

/** The family page. */
export function familyPagePath(userId: string): string {
  return `/admin/subscribers/${encodeURIComponent(userId)}`;
}

/**
 * The family page on a tab. The summary is the bare URL — the same address
 * the families panel links to, so the two never produce different URLs for
 * the same screen.
 */
export function familyTabHref(userId: string, tab: FamilyTab): string {
  const path = familyPagePath(userId);
  return tab === "summary" ? path : `${path}?tab=${tab}`;
}

// ── Account actions: why one did not happen ─────────────────────────────────

/**
 * Why an account action (deactivate, reactivate, delete) did not run. The
 * server actions answer with exactly these, and the account tab states each
 * in a sentence (accountRefusalText), so an operator never has to guess
 * whether an account was changed:
 *  - admin_target: it is an admin's account, which the tools never touch;
 *  - admin_check_failed: the admin_users lookup failed, so nothing proved it
 *    is not an admin's — the check fails closed;
 *  - email_unavailable: the account's email could not be read to check the
 *    one typed (delete);
 *  - email_mismatch: the typed email is not the account's (delete);
 *  - audit_failed: the required audit row could not be written, so the
 *    action stopped before it ran (PDPL).
 */
export const ACCOUNT_REFUSALS = [
  "admin_target",
  "admin_check_failed",
  "email_unavailable",
  "email_mismatch",
  "audit_failed",
] as const;

export type AccountRefusal = (typeof ACCOUNT_REFUSALS)[number];

const ACCOUNT_REFUSAL_TEXT: Readonly<Record<AccountRefusal, AdminStringKey>> = {
  admin_target: "fp_refused_admin_target",
  admin_check_failed: "fp_refused_admin_check",
  // The same fact the account tab states when the page itself has no email.
  email_unavailable: "fp_delete_no_email",
  email_mismatch: "fp_refused_email_mismatch",
  audit_failed: "audit_write_failed",
};

/** The sentence that tells the operator why the action did not run. */
export function accountRefusalText(refusal: AccountRefusal, locale: AdminLocale): string {
  return t(ACCOUNT_REFUSAL_TEXT[refusal], locale);
}

/**
 * Where the account tools return: the family's account tab, the tab they are
 * used from — with `?error=` when the action was refused. Only ever built
 * from an id that has passed the actions' UUID check.
 */
export function accountTabHref(userId: string, refusal?: AccountRefusal): string {
  const path = familyTabHref(userId, "account");
  return refusal ? `${path}&error=${refusal}` : path;
}

/** `?error=` on the account tab: the refusal an action redirected with, or null. */
export function parseAccountRefusal(
  value: string | readonly string[] | null | undefined,
): AccountRefusal | null {
  const code = firstParam(value);
  return (ACCOUNT_REFUSALS as readonly string[]).includes(code ?? "")
    ? (code as AccountRefusal)
    : null;
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export const FAMILY_TAB_LABEL: Readonly<Record<FamilyTab, AdminStringKey>> = {
  summary: "fp_tab_summary",
  meal: "fp_tab_meal",
  exercise: "fp_tab_exercise",
  household: "fp_tab_household",
  billing: "fp_tab_billing",
  runs: "fp_tab_runs",
  account: "fp_tab_account",
};

export function familyTabLabel(tab: FamilyTab, locale: AdminLocale): string {
  return t(FAMILY_TAB_LABEL[tab], locale);
}

/** A section of the family that a tab reads, beyond the header every tab has. */
export type TabSection = "meal" | "workout" | "household" | "runs";

const TAB_SECTIONS: Readonly<Record<FamilyTab, readonly TabSection[]>> = {
  summary: ["meal", "workout"],
  // The household only adds the children's ages to the member chips.
  meal: ["meal", "household"],
  exercise: ["workout"],
  household: ["household"],
  billing: [],
  runs: ["runs"],
  account: [],
};

/** What a tab's body awaits — and so what the page starts reading early. */
export function tabSections(tab: FamilyTab): readonly TabSection[] {
  return TAB_SECTIONS[tab];
}

// ── Names ───────────────────────────────────────────────────────────────────

/** A family's display name, or «بدون اسم». */
export function familyName(name: string | null | undefined, locale: AdminLocale): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed : t("sh_unnamed", locale);
}

// ── Account actions ─────────────────────────────────────────────────────────

/**
 * The delete dialog's typed confirmation matches the account's email
 * (trimmed, case-insensitive). The ONE comparison: the dialog enables its
 * button with it, and the delete action checks the same text against the
 * email GoTrue holds with it. An account whose email is unknown can never be
 * confirmed.
 */
export function emailMatches(typed: string, email: string | null | undefined): boolean {
  const want = email?.trim().toLowerCase();
  if (!want) return false;
  return typed.trim().toLowerCase() === want;
}

// ── Health ──────────────────────────────────────────────────────────────────

/**
 * jsonb allergies / dislikes may be string[] or [{ name_ar | name | label }].
 * Normalised for display; empty entries are dropped.
 */
export function listToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (item == null) continue;
    let text: string;
    if (typeof item === "string") text = item;
    else if (typeof item === "object") {
      const o = item as Record<string, unknown>;
      const named = o.name_ar ?? o.name ?? o.label;
      text = named != null ? String(named) : JSON.stringify(item);
    } else text = String(item);
    if (text.trim()) out.push(text);
  }
  return out;
}

/** A yes/no health answer: «نعم» / «لا», «—» when it was never answered. */
export function yesNo(value: boolean | null | undefined, locale: AdminLocale): string {
  if (value == null) return "—";
  return t(value ? "yes" : "no", locale);
}

// ── Route skeleton ──────────────────────────────────────────────────────────

// Kept in ./routeKind, which the loading skeleton imports without this
// module's dictionary.
export { subscriberRouteKind, type SubscriberRouteKind } from "./routeKind";
