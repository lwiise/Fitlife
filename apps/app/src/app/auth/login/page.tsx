import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BRAND_NAME } from "@fitlife/config";
import { createClient } from "@/lib/supabase/server";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "تسجيل الدخول",
  description: "سجلي دخولك إلى فت لايف",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cadence?: string }>;
}) {
  const { tier, cadence } = await searchParams;

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

  const webUrl =
    process.env.NEXT_PUBLIC_WEB_URL ?? "https://fitlife-landing.netlify.app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-extrabold text-3xl text-brand-ink tracking-tight">
            {BRAND_NAME.ar}
          </h1>
          <p className="mt-2 text-brand-ink-muted text-sm">
            خطة غذائية لكل البيت
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-brand-ink/5 p-8">
          <Suspense fallback={<div className="h-12" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center mt-6 text-brand-ink-muted/60 text-xs leading-relaxed">
          بتسجيل دخولك، توافقين على شروط الاستخدام وسياسة الخصوصية
        </p>

        <p className="text-center mt-4">
          <a
            href={webUrl}
            className="inline-block text-brand-ink-muted text-sm hover:text-brand-purple-900 transition-colors"
          >
            ← الرجوع للصفحة الرئيسية
          </a>
        </p>
      </div>
    </main>
  );
}
