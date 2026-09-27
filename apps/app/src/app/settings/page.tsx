import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CreditCard, LineChart, LogOut, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { AccountInfoCard } from "./AccountInfoCard";
import { DataSection } from "./DataSection";
import { LegalSection } from "./LegalSection";
import { PrivacyChoiceCard } from "./PrivacyChoiceCard";
import { genderPick } from "@/lib/copy/gender";
import { SupportSection } from "./SupportSection";

export const metadata = {
  title: "الإعدادات — فت لايف",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [subscription, { data: ownerProfile }] = await Promise.all([
    getCurrentSubscription(user.id),
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
  ]);
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;
  const g = genderPick(ownerSex);

  return (
    <main className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader
          className="mb-0"
          title="الإعدادات"
          description="حسابك وبيتك واشتراكك وبياناتك."
        />

        {/* The account's doors in one grouped list (09/2026 redesign) —
            subscription and weight tracking had no way in from here. */}
        <nav aria-label="الحساب" className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card">
          <ul className="divide-y divide-brand-line">
            {[
              { href: "/profile", icon: UserRound, title: "ملفي الشخصي", sub: "معلوماتك، الصحة والأهداف، وتفضيلات البيت" },
              {
                href: "/family",
                icon: Users,
                title: "أفراد العائلة",
                sub: g("أضيفي وعدّلي أفراد البيت ومن يطبخ", "أضِف وعدّل أفراد البيت ومن يطبخ"),
              },
              { href: "/subscription", icon: CreditCard, title: "الاشتراك", sub: "الباقة، الفواتير، والدفع" },
              { href: "/journey", icon: LineChart, title: "الوزن والمتابعة", sub: "سجلّ خاص لكل فرد" },
            ].map(({ href, icon: Icon, title, sub }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple-900 sm:px-5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint">
                    <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-brand-ink">{title}</span>
                    <span className="mt-0.5 block text-meta text-brand-ink-muted">{sub}</span>
                  </span>
                  <ChevronLeft
                    className="size-5 shrink-0 text-brand-ink-muted group-hover:text-brand-purple-900"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <AccountInfoCard
          email={user.email ?? ""}
          signupDate={user.created_at}
          subscription={subscription}
          ownerSex={ownerSex}
        />

        <DataSection userEmail={user.email ?? ""} ownerSex={ownerSex} />

        <LegalSection />

        <PrivacyChoiceCard ownerSex={ownerSex} />

        <SupportSection ownerSex={ownerSex} />

        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-critical/30 bg-brand-card px-6 text-base font-bold text-critical hover:bg-critical-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-critical focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
          >
            <LogOut className="size-5" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
