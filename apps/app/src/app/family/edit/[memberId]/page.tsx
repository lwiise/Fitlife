import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound, HeartPulse, ChevronLeft } from "lucide-react";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { PageHeader } from "@/components/ui/page-header";
import { mapSaraGoalToUser, type SaraGoal } from "@/lib/plans/goalMapping";
import { genderPick } from "@/lib/copy/gender";
import { HousekeeperForm } from "../../add/HousekeeperForm";
import { MemberEditedBanner } from "./MemberEditedBanner";
import { riyadhCurrentYear } from "@/lib/plans/dayMapping";
import {
  ACTIVITY_OPTIONS,
  CHILD_ACTIVITY,
  GOALS,
  asStringArray,
  labelFor,
} from "./labels";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export const metadata = {
  title: "تعديل فرد — فت لايف",
  robots: { index: false, follow: false },
};

/** One tappable row of the grouped list — the settings page's row shape. */
function SectionRow({
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

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const [{ memberId }, user, supabase] = await Promise.all([
    params,
    getAuthUser(),
    createClient(),
  ]);
  if (!user) redirect("/auth/login");

  // Member row + owner profile are independent — one parallel round-trip.
  const [{ data: row }, { data: ownerProfile }] = await Promise.all([
    supabase
      .from("family_members")
      .select("*")
      .eq("id", memberId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
  ]);
  const m = row as FamilyMemberRow | null;

  if (!m) redirect("/family");

  // The hub addresses the account OWNER ("عدّلي/عدّل بيانات …"), so its copy
  // follows the owner's sex — not the member's.
  const g = genderPick((ownerProfile as { sex?: string | null } | null)?.sex);

  // The maid isn't a plan beneficiary — she has only a name + reading language, so
  // she's edited via the HousekeeperForm (prefilled), not the member sections.
  if (m.role === "housekeeper") {
    return (
      <HousekeeperForm
        editing
        initial={{
          name: m.name,
          preferred_language: m.preferred_language,
          sex: m.sex,
        }}
      />
    );
  }

  const type = (m.member_type ?? "adult") as
    | "adult"
    | "child"
    | "pregnant"
    | "lactating";

  // ── Card summaries (mirror the mom profile hub) ──────────────────────────
  const age = m.birth_year ? riyadhCurrentYear() - m.birth_year : null;
  const personalSummary =
    [
      age ? `${age} سنة` : null,
      m.height_cm ? `${m.height_cm} سم` : null,
      m.weight_kg ? `${m.weight_kg} كجم` : null,
    ]
      .filter(Boolean)
      .join("، ") || g("أكملي المعلومات", "أكمل المعلومات");

  const goalLabel =
    type === "pregnant"
      ? "حامل"
      : type === "lactating"
        ? "مرضعة"
        : type === "child"
          ? "طفل"
          : m.primary_goal
            ? labelFor(GOALS, mapSaraGoalToUser(m.primary_goal as SaraGoal))
            : null;
  const activityLabel = labelFor(
    type === "child" ? CHILD_ACTIVITY : ACTIVITY_OPTIONS,
    m.activity_level,
  );
  const allergyCount = asStringArray(m.allergies).length;
  const conditionCount = (m.medical_conditions ?? []).length;
  const healthSummary =
    [
      goalLabel,
      activityLabel,
      conditionCount > 0 ? `${conditionCount} حالة صحية` : null,
      allergyCount > 0 ? `${allergyCount} حساسية` : null,
    ]
      .filter(Boolean)
      .join("، ") || g("أضيفي التفاصيل الصحية", "أضِف التفاصيل الصحية");

  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex;

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          className="mb-0"
          back={{ href: "/family", label: "العائلة" }}
          title={`تعديل بيانات ${m.name}`}
          description={g(
            "اختاري القسم الذي تريدين تعديله.",
            "اختر القسم الذي تريد تعديله.",
          )}
        />

        <Suspense fallback={null}>
          <MemberEditedBanner memberId={memberId} ownerSex={ownerSex} />
        </Suspense>

        <nav
          aria-label={`أقسام بيانات ${m.name}`}
          className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card"
        >
          <ul className="divide-y divide-brand-line">
            <SectionRow
              href={`/family/edit/${memberId}/personal`}
              title="المعلومات الشخصية"
              summary={personalSummary}
              icon={UserRound}
            />
            <SectionRow
              href={`/family/edit/${memberId}/health`}
              title="الصحة والأهداف"
              summary={healthSummary}
              icon={HeartPulse}
            />
          </ul>
        </nav>

        <p className="text-meta leading-relaxed text-brand-ink-muted">
          أي تعديل لن يُطبَّق على الخطة حتى {g("تنشئي", "تنشئ")}{" "}
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
