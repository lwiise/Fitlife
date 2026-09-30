import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound, HeartPulse, Utensils, ClipboardList, Dumbbell, ChevronLeft } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import { genderPick } from "@/lib/copy/gender";
import { PageHeader } from "@/components/ui/page-header";
import { CardHeader } from "@/components/ui/card";
import { ProfileEditedBanner } from "./ProfileEditedBanner";
import { riyadhCurrentYear } from "@/lib/plans/dayMapping";
import {
  ACTIVITY_OPTIONS,
  GOALS,
  CUISINES,
  asStringArray,
  labelFor,
} from "./labels";

export const metadata = {
  title: "ملفي الشخصي — فت لايف",
  robots: { index: false, follow: false },
};

type Row = {
  href: string;
  title: string;
  summary: string;
  icon: typeof UserRound;
};

/** One tappable row of a grouped list — the settings page's row shape. */
function SectionRow({ href, title, summary, icon: Icon }: Row) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple-900 sm:px-5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint">
          <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-brand-ink">{title}</span>
          <span className="mt-0.5 block truncate text-meta text-brand-ink-muted">{summary}</span>
        </span>
        <ChevronLeft
          className="size-5 shrink-0 text-brand-ink-muted group-hover:text-brand-purple-900"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function SectionGroup({ id, title, rows }: { id: string; title: string; rows: Row[] }) {
  return (
    // The Card surface without its padding: rows run edge to edge, as in /settings.
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card"
    >
      <CardHeader id={id} title={title} className="mb-0 px-4 pt-4 pb-1 sm:px-5" />
      <ul className="divide-y divide-brand-line">
        {rows.map((r) => (
          <SectionRow key={r.href} {...r} />
        ))}
      </ul>
    </section>
  );
}

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  const g = genderPick(profile.sex);
  const age = profile.birth_year ? riyadhCurrentYear() - profile.birth_year : null;
  const personalSummary = [
    profile.display_name,
    age ? `${age} سنة` : null,
    profile.height_cm ? `${profile.height_cm} سم` : null,
    profile.weight_kg ? `${profile.weight_kg} كجم` : null,
  ]
    .filter(Boolean)
    .join("، ") || g("أكملي معلوماتك", "أكمل معلوماتك");

  const activityLabel = labelFor(ACTIVITY_OPTIONS, profile.activity_level);
  const goalLabel = profile.primary_goal
    ? labelFor(GOALS, mapSaraGoalToUser(profile.primary_goal as SaraGoal))
    : null;
  const allergyCount = asStringArray(profile.allergies).length;
  const conditionCount = (profile.medical_conditions ?? []).length;
  const healthSummary =
    [
      goalLabel,
      activityLabel,
      conditionCount > 0 ? `${conditionCount} حالة صحية` : null,
      allergyCount > 0 ? `${allergyCount} حساسية` : null,
    ]
      .filter(Boolean)
      .join("، ") || g("أضيفي تفاصيلك الصحية", "أضِف تفاصيلك الصحية");

  const cuisineLabel = labelFor(CUISINES, profile.cuisine_preference);
  const dietaryCount = asStringArray(profile.family_dietary_restrictions).filter(
    (d) => d !== "halal",
  ).length;
  const cookingCount = asStringArray(profile.cooking_methods).length;
  const familySummary =
    [
      cuisineLabel ? `مطبخ ${cuisineLabel}` : null,
      dietaryCount > 0 ? `${dietaryCount} قيود غذائية` : null,
      cookingCount > 0 ? `${cookingCount} طرق طبخ` : null,
    ]
      .filter(Boolean)
      .join("، ") || g("حددي تفضيلات عائلتك", "حدّد تفضيلات عائلتك");

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          className="mb-0"
          back={{ fallback: "/settings" }}
          title="ملفي الشخصي"
          description={g(
            "عدّلي معلوماتكِ متى شئتِ. اختاري القسم الذي تريدين تعديله.",
            "عدّل معلوماتك متى شئت. اختر القسم الذي تريد تعديله.",
          )}
        />

        <Suspense fallback={null}>
          <ProfileEditedBanner ownerSex={profile.sex} />
        </Suspense>

        <SectionGroup
          id="profile-me"
          title={g("عنكِ", "عنك")}
          rows={[
            {
              href: "/profile/personal",
              title: "المعلومات الشخصية",
              summary: personalSummary,
              icon: UserRound,
            },
            {
              href: "/profile/health",
              title: "الصحة والأهداف",
              summary: healthSummary,
              icon: HeartPulse,
            },
            {
              href: "/profile/deep-dive",
              title: "أسئلة إضافية لخطة أدق",
              summary: "نمط يومك وعاداتك وتفضيلاتك، وكلها اختيارية",
              icon: ClipboardList,
            },
          ]}
        />

        <SectionGroup
          id="profile-plans"
          title="الخطط والبيت"
          rows={[
            {
              href: "/onboarding/workout",
              title: "خطة التمارين",
              summary: "الأسئلة والإعدادات. تعديلها يعيد إنشاء البرنامج",
              icon: Dumbbell,
            },
            {
              href: "/profile/family-preferences",
              title: "تفضيلات العائلة",
              summary: familySummary,
              icon: Utensils,
            },
          ]}
        />

        <p className="text-meta leading-relaxed text-brand-ink-muted">
          أي تعديل لن يُطبَّق على خطتك حتى {g("تنشئي", "تنشئ")}{" "}
          <Link
            href="/plan"
            className="font-bold text-brand-purple-900 underline underline-offset-4 hover:text-brand-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            خطة جديدة من صفحة الخطة
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
