/**
 * Pure logic for the full family page and its three audited views (plan,
 * program, health). No React, no I/O, no clock — client-safe, so the danger
 * zone and the route skeleton import it too.
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

/** `?error=audit_failed` — an account action was stopped because its audit row could not be written. */
export function isAuditFailure(value: string | readonly string[] | null | undefined): boolean {
  return firstParam(value) === "audit_failed";
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
 * The delete dialog's typed confirmation matches the account's email — the
 * server action's own comparison (trimmed, case-insensitive), so the button
 * enables exactly when the server would accept. An account whose email is
 * unknown can never be confirmed.
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
