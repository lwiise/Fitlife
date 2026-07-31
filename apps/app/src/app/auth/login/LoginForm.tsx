"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { capture, captureBeacon } from "@/lib/analytics";
import { isValidTier, isValidCadence } from "@/lib/tierIntent";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { Loader2, Mail } from "lucide-react";

type Mode = "signin" | "signup" | "reset";

function arabicAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "الإيميل أو كلمة المرور غير صحيحة.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "هذا الإيميل مسجّل من قبل — يمكنك تسجيل الدخول مباشرة.";
  }
  if (m.includes("password") && m.includes("at least")) {
    return "كلمة المرور لازم تكون 8 أحرف على الأقل.";
  }
  if (m.includes("email not confirmed")) {
    return "يلزم تأكيد الإيميل أولاً — رسالة التأكيد في بريدك.";
  }
  return "حصل خطأ — يمكنك المحاولة مرة ثانية.";
}

/**
 * Stable codes written by /auth/callback. It used to put the raw English
 * Supabase message into `?error=`, and the login page never read the parameter
 * at all — so the single most common failure (opening the confirmation email on
 * a different device than signup, which leaves the PKCE verifier behind) showed
 * the user a blank form with no explanation.
 */
function arabicCallbackError(code: string): string | null {
  switch (code) {
    case "missing_code":
      return "الرابط غير مكتمل. اطلبي رابطاً جديداً وحاولي مرة ثانية.";
    case "link_invalid":
      return "انتهت صلاحية الرابط أو استُخدم من جهاز آخر. افتحي الرابط على نفس الجهاز الذي سجّلتِ منه، أو اطلبي رابطاً جديداً.";
    default:
      return null;
  }
}

export function LoginForm() {
  const searchParams = useSearchParams();
  // Intent carried from the landing page (tier CTA) takes the user into
  // onboarding with the tier preselected; otherwise honor redirect_to.
  const tier = searchParams.get("tier");
  const cadence = searchParams.get("cadence");
  // redirect_to is attacker-supplied (the proxy writes it, but nothing stops a
  // hand-crafted link). Unvalidated it made this an open redirect off the
  // credential page — see safeRedirectPath. The admin panel already validated
  // its own `next`; this is the same rule.
  const nextPath =
    isValidTier(tier) && isValidCadence(cadence)
      ? `/onboarding?tier=${tier}&cadence=${cadence}`
      : safeRedirectPath(searchParams.get("redirect_to"));
  // Validated before it becomes an event property — `tier` is raw query input,
  // and an unbounded string would shred the funnel breakdown.
  const intentTier = isValidTier(tier) ? tier : null;

  // Landing CTAs pass ?mode=signup so new users start on "create account".
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "confirm-sent" | "reset-sent" | "error"
  >("idle");
  // Seeded from /auth/callback's ?error= so a failed email link explains itself
  // instead of dropping the user on a blank form.
  const [errorMessage, setErrorMessage] = useState(
    () => arabicCallbackError(searchParams.get("error") ?? "") ?? "",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();

    // Password recovery. Auth is email+password only, and there was no reset
    // path at all — a forgotten password meant permanent lockout of a paid
    // account holding meal plans, family and body-log history, with the only
    // operator tools being deactivate or delete.
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) {
        setStatus("error");
        setErrorMessage(arabicAuthError(error.message));
        return;
      }
      // Deliberately the same answer whether or not the address has an account:
      // a differing response here tells an attacker which emails are registered.
      setStatus("reset-sent");
      return;
    }

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
        // Beacon, not capture: the assign() below tears down the page, and a
        // queued event (SDK still lazy-loading) would go with it. This is the
        // top of the funnel — losing it costs every rate below.
        await captureBeacon("signup_completed", { intent_tier: intentTier });
        window.location.assign(nextPath);
        return;
      }
      // A distinct outcome, not a signup: the account exists but the user is
      // parked in their inbox and may never come back. Counting it as
      // signup_completed would inflate the top of the funnel.
      capture("signup_confirmation_sent", { intent_tier: intentTier });
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
        {/* Early return — this branch replaces the whole form, so this is the
            page's only heading. It was an h3 under no h1 or h2. */}
        <h1 className="font-bold text-lg text-brand-ink mb-2">رسالة التأكيد في إيميلك</h1>
        <p className="text-brand-ink-muted text-sm leading-relaxed">
          أرسلنا رابط تأكيد إلى
          <br />
          <span className="font-semibold text-brand-ink">{email}</span>
        </p>
        <p className="mt-4 text-brand-ink-muted/60 text-xs leading-relaxed">
          بعد تأكيد الإيميل من الرابط يمكنك تسجيل الدخول. إن لم تصل الرسالة،
          فقد تكون في مجلد السبام.
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

  if (status === "reset-sent") {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-emerald/10 mb-4">
          <Mail className="size-7 text-brand-emerald" aria-hidden="true" />
        </div>
        <h1 className="font-bold text-lg text-brand-ink mb-2">
          رابط استعادة كلمة المرور في إيميلك
        </h1>
        <p className="text-brand-ink-muted text-sm leading-relaxed">
          إذا كان
          <br />
          <span className="font-semibold text-brand-ink">{email}</span>
          <br />
          مسجّلاً عندنا، وصلكِ رابط لتعيين كلمة مرور جديدة.
        </p>
        <p className="mt-4 text-brand-ink-muted/60 text-xs leading-relaxed">
          افتحي الرابط على نفس الجهاز. إن لم تصل الرسالة، فقد تكون في مجلد السبام.
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
        {/* h1, not h2: this is the page's title and /auth/login had no h1 at
            all. Same classes, so nothing moves visually. */}
        <h1 className="font-bold text-2xl text-brand-ink leading-tight">
          {mode === "reset"
            ? "استعادة كلمة المرور"
            : mode === "signin"
              ? "تسجيل الدخول"
              : "إنشاء حساب"}
        </h1>
        <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
          {mode === "reset"
            ? "اكتبي إيميلك ونرسل لكِ رابطاً لتعيين كلمة مرور جديدة."
            : mode === "signin"
              ? "الإيميل وكلمة المرور لتسجيل الدخول."
              : "حساب جديد بإيميل وكلمة مرور."}
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

        {mode !== "reset" && (
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
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setStatus("idle");
                setErrorMessage("");
                setPassword("");
              }}
              className="mt-2 inline-flex items-center min-h-11 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
            >
              نسيت كلمة المرور؟
            </button>
          )}
        </div>
        )}

        {status === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email || (mode !== "reset" && !password)}
          className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {mode === "reset"
                ? "جاري الإرسال..."
                : mode === "signin"
                  ? "جاري الدخول..."
                  : "جاري الإنشاء..."}
            </>
          ) : mode === "reset" ? (
            "إرسال رابط الاستعادة"
          ) : mode === "signin" ? (
            "دخول"
          ) : (
            "إنشاء الحساب"
          )}
        </button>
      </form>

      <p className="text-center mt-6 text-brand-ink-muted text-sm">
        {mode === "reset"
          ? "تذكرتِ كلمة المرور؟ "
          : mode === "signin"
            ? "ما عندك حساب؟ "
            : "عندك حساب؟ "}
        <button
          type="button"
          onClick={() => {
            setMode((prev) => (prev === "signin" ? "signup" : "signin"));
            setStatus("idle");
            setErrorMessage("");
          }}
          className="text-brand-purple-900 hover:text-brand-purple-700 font-bold underline underline-offset-4"
        >
          {mode === "signin" ? "إنشاء حساب" : "تسجيل الدخول"}
        </button>
      </p>
    </div>
  );
}
