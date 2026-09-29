import { FAMILY_VIEWS, type FamilyView } from "@/lib/admin/console-types";
import type { AdminStringKey } from "@/lib/admin/i18n";
import type { Tone } from "../_ui/Pill";

/** Dot colour of each saved view in the rail (prototype Concept A). */
export const VIEW_TONE: Record<FamilyView, Tone> = {
  all: "pur",
  attention: "crit",
  trialing: "neu",
  active: "ok",
  past_due: "warn",
  cancelling: "neu",
  ended: "neu",
};

/** The string key of each saved view's name («تحتاج متابعة»…). */
export const VIEW_LABEL_KEY: Record<FamilyView, AdminStringKey> = {
  all: "sh_view_all",
  attention: "sh_view_attention",
  trialing: "sh_view_trialing",
  active: "sh_view_active",
  past_due: "sh_view_past_due",
  cancelling: "sh_view_cancelling",
  ended: "sh_view_ended",
};

/** A `?view=` value, validated; anything unknown is "all". */
export function parseView(value: string | null | undefined): FamilyView {
  return FAMILY_VIEWS.includes(value as FamilyView) ? (value as FamilyView) : "all";
}

/** The families list opened on a saved view. */
export function familiesViewHref(view: FamilyView): string {
  return `/admin/families?view=${view}`;
}

/** Where a family opens: the side panel on wide screens, the page otherwise. */
export function familyHref(id: string, wide: boolean): string {
  return wide
    ? `/admin/families?open=${encodeURIComponent(id)}`
    : `/admin/subscribers/${encodeURIComponent(id)}`;
}

/** Matches the CSS breakpoint at which the rail and the side sheet exist. */
export const WIDE_QUERY = "(min-width: 1024px)";
