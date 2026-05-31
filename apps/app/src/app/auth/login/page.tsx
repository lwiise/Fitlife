import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "تسجيل الدخول",
  description: "سجلي دخولك إلى فت لايف",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cadence?: string; deleted?: string }>;
}) {
  const { tier, cadence, deleted } = await searchParams;

  // Already signed in? Skip the form. If they arrived from a tier CTA, take
  // them straight to pricing with that tier preselected; otherwise dashboard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (isValidTier(tier) && isValidCadence(cadence)) {
      redirect(`/pricing?tier=${tier}&cadence=${cadence}`);
    }
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo priority className="h-20 w-auto mx-auto" />
          <p className="mt-3 text-brand-ink-muted text-sm">
            خطة غذائية لكل البيت
          </p>
        </div>

        {deleted === "1" && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-2xl border border-brand-emerald/30 bg-brand-emerald/10 px-4 py-3"
          >
            <p className="text-brand-emerald text-sm font-medium leading-relaxed text-center">
              تم حذف حسابك بنجاح. شكراً لاستخدامك فت لايف.
            </p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl border border-brand-ink/5 p-8">
          <Suspense fallback={<div className="h-12" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center mt-6 text-brand-ink-muted/60 text-xs leading-relaxed">
          بإنشاء حساب، أنتِ توافقين على{" "}
          <Link
            href="/terms"
            className="text-brand-purple-900 underline underline-offset-4 hover:text-brand-purple-700 transition-colors"
          >
            شروط الاستخدام
          </Link>{" "}
          و{" "}
          <Link
            href="/privacy"
            className="text-brand-purple-900 underline underline-offset-4 hover:text-brand-purple-700 transition-colors"
          >
            سياسة الخصوصية
          </Link>
        </p>

        <p className="text-center mt-4">
          <Link
            href="/"
            className="inline-block text-brand-ink-muted text-sm hover:text-brand-purple-900 transition-colors"
          >
            ← الرجوع للصفحة الرئيسية
          </Link>
        </p>
      </div>
    </main>
  );
}
