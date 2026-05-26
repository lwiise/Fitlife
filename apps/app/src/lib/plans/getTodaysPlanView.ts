import "server-only";

import type { MemberPlan } from "@fitlife/plan-engine";
import { getLatestPlan } from "./getLatestPlan";
import { getCurrentUserProfile } from "@/lib/supabase/queries";

export type TodaysPlanView =
  | { status: "no_plan" }
  | { status: "generating"; planId: string }
  | { status: "failed"; planId: string; error: string | null }
  | { status: "ready"; planId: string; members: MemberPlan[] };

/**
 * Server-side fetch + status branch + member ordering for the dashboard's
 * "today" zone. Does NOT do any date logic — the client picks today's day_index
 * from the device (see dayMapping). Members are ordered Mom first, then by the
 * profile's member_addition_order, then any leftovers.
 */
export async function getTodaysPlanView(userId: string): Promise<TodaysPlanView> {
  const latest = await getLatestPlan(userId);
  if (!latest) return { status: "no_plan" };
  if (latest.status === "generating") return { status: "generating", planId: latest.id };
  if (latest.status === "failed" || !latest.plan_data) {
    return { status: "failed", planId: latest.id, error: latest.error_message };
  }

  const members = latest.plan_data.members;
  const profile = await getCurrentUserProfile();
  const rawOrder = profile?.member_addition_order;
  const additionOrder = Array.isArray(rawOrder)
    ? rawOrder.filter((x): x is string => typeof x === "string")
    : [];

  const rank = (m: MemberPlan): number => {
    if (m.member_id === "mom") return -1;
    const i = additionOrder.indexOf(m.member_id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ordered = [...members].sort((a, b) => rank(a) - rank(b));

  return { status: "ready", planId: latest.id, members: ordered };
}
