import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkoutProfileSchema, type WorkoutProfile } from "@fitlife/plan-engine";
import { Logo } from "@/components/Logo";
import { WorkoutQuestions, type WorkoutPerson } from "./WorkoutQuestions";

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
 * the housekeeper are never eligible.
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
      .select("display_name, mom_profile_completed_at, workout_profile, sex")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("family_members")
      .select("id, name, member_type, role, workout_profile, sex")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true }),
  ]);

  if (!profile?.mom_profile_completed_at) redirect("/onboarding");

  const people: WorkoutPerson[] = [
    {
      target: "mom",
      name: profile.display_name ?? "أنا",
      sex: profile.sex ?? null,
      existing: parseProfile(profile.workout_profile),
    },
    ...(members ?? [])
      .filter((m) => m.member_type !== "child" && m.role !== "housekeeper")
      .map((m) => ({
        target: m.id as string,
        name: m.name as string,
        sex: (m.sex as string | null) ?? null,
        existing: parseProfile(m.workout_profile),
      })),
  ];

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4">
          <Logo className="h-9 w-auto" />
        </div>
      </header>
      <div className="container-app py-8 md:py-12 max-w-2xl">
        <WorkoutQuestions people={people} ownerSex={profile.sex ?? null} />
      </div>
    </main>
  );
}
