import Link from "next/link";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
} from "@/lib/supabase/queries";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { FamilyMemberCard } from "./FamilyMemberCard";
import { HousekeeperCard } from "./HousekeeperCard";
import { AddMemberPicker } from "./AddMemberPicker";

export const metadata = { title: "عائلتك" };

export default async function FamilyPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/auth/login");
  // Mom must finish her own profile before managing the family.
  if (!profile.mom_profile_completed_at) redirect("/onboarding");

  const allMembers = await getCurrentUserFamilyMembers();
  const members = allMembers.filter((m) => m.role !== "housekeeper");
  const housekeeper = allMembers.find((m) => m.role === "housekeeper");

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <Logo className="h-9 w-auto" />
          <div className="flex items-center gap-2">
            <BackToDashboard />
            <SettingsLink />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            عائلتك
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            كل فرد تضيفينه يأخذ خطته الخاصة ضمن وجبات منسقة للعائلة.
          </p>
        </header>

        <div className="space-y-3">
          {/* Mom — edits via her own profile flow (/profile), not the member wizard. */}
          <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-brand-ink/5">
            <div className="size-10 rounded-full bg-brand-pink-light flex items-center justify-center flex-shrink-0">
              <User className="size-5 text-brand-pink" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-ink truncate">
                <span className="text-brand-pink">أنتِ</span>
                {profile.display_name ? ` — ${profile.display_name}` : ""}
              </p>
              <p className="text-brand-ink-muted text-xs mt-0.5">صاحبة الحساب</p>
            </div>
            <Link
              href="/profile"
              className="text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md px-1 min-h-11 inline-flex items-center flex-shrink-0"
            >
              تعديل
            </Link>
          </div>

          {members.map((m) => (
            <FamilyMemberCard
              key={m.id}
              id={m.id}
              name={m.name}
              memberType={m.member_type ?? "adult"}
              primaryGoal={m.primary_goal}
            />
          ))}

          {housekeeper && (
            <HousekeeperCard
              id={housekeeper.id}
              name={housekeeper.name}
              preferredLanguage={housekeeper.preferred_language}
            />
          )}
        </div>

        <AddMemberPicker />
      </div>
    </main>
  );
}
