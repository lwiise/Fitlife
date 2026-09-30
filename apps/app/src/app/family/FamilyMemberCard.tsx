import { User, Baby, HeartPulse, Milk } from "lucide-react";
import { isSpouseRole } from "@fitlife/plan-engine/familyRole";
import { AvatarPhotoButton } from "@/components/profile-photo/ProfilePhotoTriggers";
import { ButtonLink } from "@/components/ui/button";
import { RemoveMemberButton } from "./RemoveMemberButton";

const TYPE_META: Record<
  string,
  { label: string; Icon: typeof User }
> = {
  adult: { label: "بالغ", Icon: User },
  child: { label: "طفل", Icon: Baby },
  pregnant: { label: "حامل", Icon: HeartPulse },
  lactating: { label: "مرضعة", Icon: Milk },
};

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "نزول الوزن",
  muscle_gain: "زيادة العضل",
  body_recomposition: "إعادة تركيب الجسم",
  athletic_performance: "الأداء الرياضي",
  metabolic_health: "الصحة الأيضية",
  digestive_health: "صحة الجهاز الهضمي",
  pregnancy_lactation: "الحمل والرضاعة",
  posture_recovery: "القوام والتعافي",
  // Promoted to first-class goals in the 07/2026 questionnaire rework; both
  // are reachable from ordinary UI choices and rendered as a blank line here.
  maintain: "ثبات الوزن",
  general_health: "الصحة العامة",
};

/**
 * One member's row inside the /family household list (an <li> of the grouped
 * card). The avatar colour follows the ROSTER position (owner 0), so the
 * person keeps the colour the home screen's season board gives them; tapping
 * the avatar sets their profile photo.
 */
export function FamilyMemberCard({
  id,
  name,
  role,
  sex,
  memberType,
  primaryGoal,
  rosterIndex,
  photoSrc,
  ownerSex,
}: {
  id: string;
  name: string;
  role: string;
  sex: string | null;
  memberType: string;
  primaryGoal: string | null;
  rosterIndex: number;
  /** Their profile photo; the avatar opens the sheet that sets it. */
  photoSrc: string | null;
  ownerSex?: string | null;
}) {
  const meta = TYPE_META[memberType] ?? TYPE_META.adult!;
  const { Icon } = meta;
  // The spouse reads as what they are, not as «بالغ»: the same words as the
  // add picker's row («زوج» / «زوجة»).
  const typeLabel = isSpouseRole(role) ? (sex === "female" ? "زوجة" : "زوج") : meta.label;
  const goal = primaryGoal ? GOAL_LABELS[primaryGoal] : undefined;

  return (
    <li className="flex min-h-16 items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <AvatarPhotoButton person={{ id, name, rosterIndex, src: photoSrc }} ownerSex={ownerSex} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-brand-ink">{name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-meta text-brand-ink-muted">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {typeLabel}
            {goal ? ` · ${goal}` : ""}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ButtonLink
          href={`/family/edit/${id}`}
          variant="quiet"
          aria-label={`تعديل ${name}`}
        >
          تعديل
        </ButtonLink>
        <RemoveMemberButton memberId={id} name={name} ownerSex={ownerSex} />
      </div>
    </li>
  );
}
