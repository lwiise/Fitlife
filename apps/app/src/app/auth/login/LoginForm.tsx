"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { Loader2, Mail } from "lucide-react";

type Mode = "signin" | "signup";

function arabicAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "الإيميل أو كلمة المرور غير صحيحة.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "هذا الإيميل مسجّل من قبل. سجّلي دخولك.";
  }
  if (m.includes("password") && m.includes("at least")) {
    return "كلمة المرور لازم تكون 8 أحرف على الأقل.";
  }
  if (m.includes("email not confirmed")) {
    return "لازم تأكدين إيميلك أولاً. تفقّدي رسالة التأكيد.";
  }
  return "حصل خطأ. حاولي مرة ثانية.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  // Intent carried from the landing page (tier CTA) takes the user into
  // onboarding with the tier preselected; otherwise honor redirect_to.
  const tier = searchParams.get("tier");
  const cadence = searchParams.get("cadence");
  const nextPath =
    isValidTier(tier) && isValidCadence(cadence)
      ? `/onboarding?tier=${tier}&cadence=${cadence}`
      : searchParams.get("redirect_to") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "confirm-sent" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const callbackUrl = `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(nextPath)}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl },
      });

      if (error) {
        setStatus("error");
        setErrorMessage(arabicAuthError(error.message));
        return;
      }

      // If email confirmation is OFF, signUp returns an active session →
      // log straight in. If it's ON, there's no session yet → ask the user
      // to confirm via the email link.
      if (data.session) {
        window.location.assign(nextPath);
        return;
      }
      setStatus("confirm-sent");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(arabicAuthError(error.message));
      return;
    }

    // Hard navigation so the proxy picks up the freshly-set session cookie.
    window.location.assign(nextPath);
  }

  if (status === "confirm-sent") {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-emerald/10 mb-4">
          <Mail className="size-7 text-brand-emerald" aria-hidden="true" />
        </div>
        <h3 className="font-bold text-lg text-brand-ink mb-2">تفقّدي إيميلك</h3>
        <p className="text-brand-ink-muted text-sm leading-relaxed">
          أرسلنا رابط تأكيد إلى
          <br />
          <span className="font-semibold text-brand-ink">{email}</span>
        </p>
        <p className="mt-4 text-brand-ink-muted/60 text-xs leading-relaxed">
          أكّدي إيميلك من الرابط، بعدها تقدرين تسجّلين دخولك. لو ما وصل، تفقّدي
          مجلد السبام.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setMode("signin");
            setPassword("");
          }}
          className="mt-6 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-bold text-2xl text-brand-ink leading-tight">
          {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
        </h2>
        <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
          {mode === "signin"
            ? "أدخلي إيميلك وكلمة المرور."
            : "أنشئي حسابك بإيميل وكلمة مرور."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            الإيميل
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            autoComplete="email"
            dir="ltr"
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-brand-surface text-brand-ink placeholder:text-brand-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-purple-900 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            كلمة المرور
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            dir="ltr"
            placeholder="********"
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-brand-surface text-brand-ink placeholder:text-brand-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-purple-900 focus:border-transparent transition-all"
          />
          {mode === "signup" && (
            <p className="mt-1.5 text-brand-ink-muted/60 text-xs">
              8 أحرف على الأقل.
            </p>
          )}
        </div>

        {status === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {mode === "signin" ? "جاري الدخول..." : "جاري الإنشاء..."}
            </>
          ) : mode === "signin" ? (
            "دخول"
          ) : (
            "إنشاء الحساب"
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-brand-ink-muted text-sm">
        {mode === "signin" ? "ما عندك حساب؟ " : "عندك حساب؟ "}
        <button
          type="button"
          onClick={() => {
            setMode((prev) => (prev === "signin" ? "signup" : "signin"));
            setStatus("idle");
            setErrorMessage("");
          }}
          className="text-brand-purple-900 hover:text-brand-purple-700 font-bold underline underline-offset-4"
        >
          {mode === "signin" ? "أنشئي حساب" : "سجّلي دخولك"}
        </button>
      </p>
    </div>
  );
}
