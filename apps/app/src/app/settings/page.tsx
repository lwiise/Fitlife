import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSubscription } from "@/lib/subscription/state";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { AccountInfoCard } from "./AccountInfoCard";
import { DataSection } from "./DataSection";
import { LegalSection } from "./LegalSection";
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

  const subscription = await getCurrentSubscription(user.id);

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
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-8">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            الإعدادات
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            معلومات حسابك وبياناتك والمستندات القانونية.
          </p>
        </header>

        <AccountInfoCard
          email={user.email ?? ""}
          signupDate={user.created_at}
          subscription={subscription}
        />

        <DataSection userEmail={user.email ?? ""} />

        <LegalSection />

        <SupportSection />
      </div>
    </main>
  );
}
