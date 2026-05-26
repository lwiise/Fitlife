import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound, HeartPulse, Utensils, ChevronLeft } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { mapSaraGoalToUser } from "@/lib/plans/goalMapping";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { ProfileEditedBanner } from "./ProfileEditedBanner";
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

const currentYear = new Date().getFullYear();

function SectionCard({
  href,
  title,
  summary,
  icon: Icon,
}: {
  href: string;
  title: string;
  summary: string;
  icon: typeof UserRound;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-white rounded-2xl border border-brand-ink/5 p-5 md:p-6 group hover:border-brand-purple-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
    >
      <div className="size-11 rounded-full bg-brand-lavender/30 flex items-center justify-center flex-shrink-0">
        <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-brand-ink text-base">{title}</h2>
        <p className="text-brand-ink-muted text-sm mt-0.5 truncate">{summary}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-brand-purple-900 text-sm font-bold flex-shrink-0 group-hover:text-brand-purple-700 transition-colors">
        تعديل
        <ChevronLeft className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/onboarding");

  const age = profile.birth_year ? currentYear - profile.birth_year : null;
  const personalSummary = [
    profile.display_name,
    age ? `${age} سنة` : null,
    profile.height_cm ? `${profile.height_cm} سم` : null,
    profile.weight_kg ? `${profile.weight_kg} كجم` : null,
  ]
    .filter(Boolean)
    .join("، ") || "أكملي معلوماتك";

  const activityLabel = labelFor(ACTIVITY_OPTIONS, profile.activity_level);
  const goalLabel = profile.primary_goal
    ? labelFor(GOALS, mapSaraGoalToUser(profile.primary_goal as never))
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
      .join("، ") || "أضيفي تفاصيلك الصحية";

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
      .join("، ") || "حددي تفضيلات عائلتك";

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <div className="flex items-center gap-2">
            <BackToDashboard />
            <SettingsLink />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            ملفي الشخصي
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            عدّلي معلوماتك ساعة ما تبين. اختاري القسم اللي تبين تعدّلينه.
          </p>
        </header>

        <Suspense fallback={null}>
          <ProfileEditedBanner />
        </Suspense>

        <div className="space-y-3">
          <SectionCard
            href="/profile/personal"
            title="المعلومات الشخصية"
            summary={personalSummary}
            icon={UserRound}
          />
          <SectionCard
            href="/profile/health"
            title="الصحة والأهداف"
            summary={healthSummary}
            icon={HeartPulse}
          />
          <SectionCard
            href="/profile/family-preferences"
            title="تفضيلات العائلة"
            summary={familySummary}
            icon={Utensils}
          />
        </div>

        <div className="rounded-2xl bg-white/60 border border-brand-ink/5 px-4 py-3">
          <p className="text-brand-ink-muted text-sm leading-relaxed">
            أي تعديل لن يطبق على خطتك حتى تنشئي{" "}
            <Link
              href="/plan"
              className="text-brand-purple-900 font-bold underline underline-offset-4 hover:text-brand-purple-700 transition-colors"
            >
              خطة جديدة من صفحة الخطة
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
