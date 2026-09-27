import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { TodayAbsence } from "./todayTable";

/**
 * Today's meal_absences (00021) for the dashboard table. Calendar-keyed like
 * /plan's read — every dispatch mints a new plan row, so a plan-id read would
 * go empty mid-week. Degrades to [] on any error: the table then shows the
 * full sharer list, which is exactly the pre-00021 behaviour.
 */
export async function getTodayAbsences(
  userId: string,
  todayISO: string,
  dayIndex: number,
): Promise<TodayAbsence[]> {
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("meal_absences")
      .select("slot, member_id")
      .eq("user_id", userId)
      .eq("local_date", todayISO)
      .limit(100);
    if (error || !data) return [];
    return (data as Array<{ slot: string; member_id: string }>)
      .filter((r) => r.member_id)
      .map((r) => ({ day_index: dayIndex, slot: r.slot, member_id: r.member_id }));
  } catch {
    return [];
  }
}
