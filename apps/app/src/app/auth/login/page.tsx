import { Suspense } from "react";
import { BRAND_NAME } from "@fitlife/config";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "تسجيل الدخول",
  description: "سجلي دخولك إلى فت لايف",
};

export default function LoginPage() {
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
          <div className="text-center mb-6">
            <h2 className="font-bold text-2xl text-brand-ink leading-tight">
              تسجيل الدخول
            </h2>
            <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
              أدخلي إيميلك، نرسل لكِ رابط دخول سحري — بدون كلمة سر.
            </p>
          </div>

          <Suspense fallback={<div className="h-12" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center mt-6 text-brand-ink-muted/60 text-xs leading-relaxed">
          بتسجيل دخولك، توافقين على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </main>
  );
}
