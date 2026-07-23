import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutProfileSchema, type WorkoutProfile } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import {
  momWorkoutIneligibleReason,
  workoutIneligibleReason,
} from "@/lib/plans/workoutEligibility";
import {
  WorkoutQuestions,
  type WorkoutPerson,
  type ExcludedPerson,
} from "./WorkoutQuestions";

export const metadata = {
  title: "أسئلة خطة التمارين — فت لايف",
  robots: { index: false, follow: false },
};

function parseProfile(v: unknown): WorkoutProfile | null {
  if (v == null) return null;
  const parsed = WorkoutProfileSchema.safeParse(v);
  return parsed.success ? parsed.data : null;
}

/**
 * The workout opt-in questionnaire. Reached from the onboarding plan-scope
 * fork, the dashboard opt-in card, and the profile edit entry. Children and
 * the housekeeper are never eligible — and the age gate covers the account
 * holder herself: an under-18 mom shows as excluded exactly like an under-18
 * member (signup accepts any birth_year up to the current year).
 */
export default async function WorkoutOptInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, mom_profile_completed_at, onboarding_completed_at, workout_profile, sex, birth_year",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("family_members")
      .select("id, name, member_type, role, workout_profile, sex, birth_year")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true }),
  ]);

  if (!profile?.mom_profile_completed_at) redirect("/onboarding");

  const momReason = momWorkoutIneligibleReason({
    birth_year: profile.birth_year ?? null,
  });
  const momName = profile.display_name ?? "أنا";

  const people: WorkoutPerson[] = [
    ...(momReason === null
      ? [
          {
            target: "mom" as const,
            name: momName,
            sex: profile.sex ?? null,
            existing: parseProfile(profile.workout_profile),
          },
        ]
      : []),
    ...(members ?? [])
      .filter((m) => workoutIneligibleReason(m) === null)
      .map((m) => ({
        target: m.id as string,
        name: m.name as string,
        sex: (m.sex as string | null) ?? null,
        existing: parseProfile(m.workout_profile),
      })),
  ];

  // Ineligible people are still shown (muted, with the reason) so a family
  // of N never wonders why the list is shorter than the household. The mom
  // appears here too when under-age — with everyone excluded the selection
  // screen still renders and simply has no one to continue with.
  const excluded: ExcludedPerson[] = [
    ...(momReason ? [{ id: "mom", name: momName, reason: momReason }] : []),
    ...(members ?? []).flatMap((m) => {
      const reason = workoutIneligibleReason(m);
      return reason
        ? [{ id: m.id as string, name: m.name as string, reason }]
        : [];
    }),
  ];

  // First-screen exit, PR #50 style (deterministic, never router.back()):
  // mid-onboarding the previous page is the plan-scope fork; afterwards the
  // opt-in entries (dashboard banner, plan view, profile) all resolve to the
  // dashboard hub.
  const backHref = profile.onboarding_completed_at
    ? "/dashboard"
    : "/onboarding/plan-scope";

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <Logo className="h-9 w-auto" />
        </div>
      </header>
      <div className="container-app py-8 md:py-12 max-w-2xl">
        <WorkoutQuestions
          people={people}
          excluded={excluded}
          ownerSex={profile.sex ?? null}
          backHref={backHref}
        />
      </div>
    </main>
  );
}
