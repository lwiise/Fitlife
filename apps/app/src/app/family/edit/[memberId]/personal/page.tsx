import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/BackButton";
import { MemberPersonalEditForm } from "./MemberPersonalEditForm";

type FamilyMemberRow = Database["public"]["Tables"]["family_members"]["Row"];

export const metadata = {
  title: "المعلومات الشخصية — فت لايف",
  robots: { index: false, follow: false },
};

export default async function MemberPersonalEditPage({
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
  // The maid has no personal/health sections — bounce to her own edit screen.
  if (m.role === "housekeeper") redirect(`/family/edit/${memberId}`);

  const type = m.member_type ?? "adult";
  // Sex is fixed for the husband (male); everyone else can set it.
  const showSex = !(type === "adult" && m.role === "dad");

  // The form addresses the account OWNER, so its copy follows the owner's sex.
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;

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
          <BackButton href={`/family/edit/${memberId}`} />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl">
        <MemberPersonalEditForm
          memberId={memberId}
          showSex={showSex}
          ownerSex={ownerSex}
          initial={{
            name: m.name,
            birth_year: m.birth_year,
            sex: m.sex === "male" ? "male" : m.sex === "female" ? "female" : null,
            height_cm: m.height_cm,
            weight_kg: m.weight_kg,
          }}
        />
      </div>
    </main>
  );
}
