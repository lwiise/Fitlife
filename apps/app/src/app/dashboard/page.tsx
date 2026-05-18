import { Sparkles, Users, Calendar } from "lucide-react";
import {
  getCurrentUserProfile,
  getCurrentUserFamilyMembers,
  getCurrentUserMealPlan,
} from "@/lib/supabase/queries";
import { LogoutButton } from "./LogoutButton";

export const metadata = {
  title: "لوحة التحكم",
};

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();
  const familyMembers = await getCurrentUserFamilyMembers();
  const currentPlan = await getCurrentUserMealPlan();

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4">
        <div className="text-center">
          <p className="text-brand-ink-muted">يتم تحضير حسابك...</p>
        </div>
      </main>
    );
  }

  const displayName = profile.display_name || "أهلاً";
  const onboardingDone = profile.onboarding_completed_at !== null;

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <h1 className="font-extrabold text-xl text-brand-ink">فت لايف</h1>
          <LogoutButton />
        </div>
      </header>

      <div className="container-app py-8 md:py-12">
        <div className="mb-8">
          <p className="text-brand-ink-muted text-sm">أهلاً،</p>
          <h2 className="font-extrabold text-2xl md:text-3xl text-brand-ink mt-1 leading-tight">
            {displayName}
          </h2>
        </div>

        {!onboardingDone && (
          <div className="bg-brand-purple-900 text-white rounded-3xl p-6 md:p-8 mb-8">
            <div className="flex items-start gap-3 mb-3">
              <Sparkles className="size-6 text-brand-yellow flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg md:text-xl leading-tight">
                  خطتك على بعد دقيقتين
                </h3>
                <p className="text-white/80 text-sm mt-2 leading-relaxed">
                  جاوبي على 8 أسئلة سريعة عشان نصمم لكِ ولعائلتك خطة غذائية شخصية.
                </p>
              </div>
            </div>
            <a
              href="/onboarding"
              className="inline-flex items-center gap-2 bg-white text-brand-purple-900 hover:bg-brand-yellow font-bold text-sm px-5 py-2.5 rounded-full mt-2 transition-colors"
            >
              ابدئي الآن
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-brand-ink/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-lavender/30 flex items-center justify-center">
                <Users className="size-5 text-brand-purple-900" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">أفراد العائلة</p>
            </div>
            <p className="font-extrabold text-3xl text-brand-ink mt-1 tabular-nums">
              {familyMembers.length}
            </p>
            <p className="text-brand-ink-muted text-xs mt-1">
              {familyMembers.length === 0 ? "ما أضفتي أحد بعد" : "مسجلين معاكِ"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-brand-ink/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-pink-light flex items-center justify-center">
                <Calendar className="size-5 text-brand-pink" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">الخطة الحالية</p>
            </div>
            <p className="font-extrabold text-3xl text-brand-ink mt-1">
              {currentPlan ? "نشطة" : "—"}
            </p>
            <p className="text-brand-ink-muted text-xs mt-1">
              {currentPlan
                ? `بدأت ${new Date(currentPlan.generated_at!).toLocaleDateString("ar-SA")}`
                : "ما عندك خطة بعد"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-brand-ink/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-brand-yellow/20 flex items-center justify-center">
                <Sparkles className="size-5 text-brand-yellow" />
              </div>
              <p className="text-brand-ink-muted text-sm font-medium">الاشتراك</p>
            </div>
            <p className="font-extrabold text-3xl text-brand-ink mt-1">
              مجاني
            </p>
            <p className="text-brand-ink-muted text-xs mt-1">
              فترة تجريبية
            </p>
          </div>
        </div>

        <details className="mt-12 text-xs text-brand-ink-muted/40">
          <summary className="cursor-pointer hover:text-brand-ink-muted transition-colors">
            معلومات تشخيصية (للمطور فقط)
          </summary>
          <pre className="mt-2 p-3 bg-white/50 rounded-lg overflow-auto">
            {JSON.stringify({ profile, familyMembers, currentPlan }, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
