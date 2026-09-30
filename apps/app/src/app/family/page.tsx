import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserProfilePhotos,
} from "@/lib/supabase/queries";
import { householdPhotoSrcs } from "@/lib/profilePhoto/shared";
import { AvatarPhotoButton } from "@/components/profile-photo/ProfilePhotoTriggers";
import { FamilyMemberCard } from "./FamilyMemberCard";
import { HousekeeperCard } from "./HousekeeperCard";
import { FamilyAddBuilder } from "./FamilyAddBuilder";
import { genderPick } from "@/lib/copy/gender";
import { isSpouseRole } from "@fitlife/plan-engine/familyRole";

export const metadata = { title: "عائلتك" };

export default async function FamilyPage() {
  // Fetched together — the redirect guards below only need profile, and the
  // members read is wasted only on the (rare) redirect path.
  const [profile, allMembers, photoPaths] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserFamilyMembers(),
    getCurrentUserProfilePhotos(),
  ]);
  if (!profile) redirect("/auth/login");
  // Mom must finish her own profile before managing the family.
  if (!profile.mom_profile_completed_at) redirect("/onboarding");
  const g = genderPick(profile.sex);

  const members = allMembers.filter((m) => m.role !== "housekeeper");
  const housekeeper = allMembers.find((m) => m.role === "housekeeper");

  const ownerName = profile.display_name?.trim() || g("أنتِ", "أنتَ");
  // Everyone in «أهل البيت» can have a photo; the cook's row keeps its icon.
  const photos = householdPhotoSrcs(photoPaths, allMembers);

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          className="mb-0"
          title="عائلتك"
          description={g(
            "كل فرد تضيفينه يأخذ خطته الخاصة ضمن وجبات منسقة للعائلة.",
            "كل فرد تضيفه يأخذ خطته الخاصة ضمن وجبات منسقة للعائلة.",
          )}
        />

        <section
          aria-labelledby="family-household"
          className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card"
        >
          <CardHeader
            id="family-household"
            title="أهل البيت"
            className="mb-0 px-4 pt-4 pb-1 sm:px-5"
          />
          <ul className="divide-y divide-brand-line">
            {/* The owner edits via her own profile flow (/profile), not the member wizard. */}
            <li className="flex min-h-16 items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
              <AvatarPhotoButton
                person={{ id: "mom", name: ownerName, rosterIndex: 0, src: photos.mom ?? null }}
                ownerSex={profile.sex}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-brand-ink">
                  {g("أنتِ", "أنتَ")}
                  {profile.display_name ? ` · ${profile.display_name}` : ""}
                </p>
                <p className="mt-0.5 text-meta text-brand-ink-muted">
                  {g("صاحبة الحساب", "صاحب الحساب")}
                </p>
              </div>
              <ButtonLink href="/profile" variant="quiet" className="shrink-0">
                تعديل
              </ButtonLink>
            </li>

            {/* Roster index follows the season board: owner 0, members in list order. */}
            {members.map((m, i) => (
              <FamilyMemberCard
                key={m.id}
                id={m.id}
                name={m.name}
                role={m.role}
                sex={m.sex}
                memberType={m.member_type ?? "adult"}
                primaryGoal={m.primary_goal}
                rosterIndex={i + 1}
                photoSrc={photos[m.id] ?? null}
                ownerSex={profile.sex}
              />
            ))}
          </ul>
        </section>

        {housekeeper && (
          <section
            aria-labelledby="family-cook"
            className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card"
          >
            <CardHeader
              id="family-cook"
              title="من يطبخ"
              className="mb-0 px-4 pt-4 pb-1 sm:px-5"
            />
            <ul>
              <HousekeeperCard
                id={housekeeper.id}
                name={housekeeper.name}
                preferredLanguage={housekeeper.preferred_language}
                ownerSex={profile.sex}
              />
            </ul>
          </section>
        )}

        <FamilyAddBuilder
          canAddSpouse={!members.some((m) => isSpouseRole(m.role))}
          canAddHousekeeper={!housekeeper}
          ownerSex={profile.sex}
        />
      </div>
    </main>
  );
}
