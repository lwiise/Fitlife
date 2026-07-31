"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Set a new password from a recovery link.
 *
 * The recovery session created by /auth/callback is what authorises this, so no
 * current password is asked for. On success we send the user to the dashboard
 * with a hard navigation, matching the sign-in path — the proxy needs to see
 * the refreshed cookie.
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const submitting = status === "submitting";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Checked before the round-trip so the mismatch reads as a form error
    // rather than a server failure.
    if (password !== confirm) {
      setStatus("error");
      setErrorMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    setStatus("submitting");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      // The recovery session is short-lived; an expired one is the likely
      // cause and the user needs a fresh link, not a retry of this form.
      setErrorMessage(
        error.message.toLowerCase().includes("session")
          ? "انتهت صلاحية الرابط. اطلبي رابطاً جديداً من صفحة تسجيل الدخول."
          : "تعذّر تحديث كلمة المرور. يمكنك المحاولة مرة ثانية.",
      );
      return;
    }

    window.location.assign("/dashboard");
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="font-bold text-2xl text-brand-ink leading-tight">
          كلمة مرور جديدة
        </h1>
        <p className="mt-2 text-brand-ink-muted text-sm leading-relaxed">
          اختاري كلمة مرور جديدة لحسابك.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            كلمة المرور الجديدة
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
            autoComplete="new-password"
            dir="ltr"
            placeholder="********"
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-brand-surface text-brand-ink placeholder:text-brand-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-purple-900 focus:border-transparent transition-all"
          />
          <p className="mt-1.5 text-brand-ink-muted/60 text-xs">
            8 أحرف على الأقل.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-bold text-brand-ink mb-2"
          >
            تأكيد كلمة المرور
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            disabled={submitting}
            autoComplete="new-password"
            dir="ltr"
            placeholder="********"
            className="w-full px-4 py-3 rounded-xl border border-brand-ink/10 bg-brand-surface text-brand-ink placeholder:text-brand-ink-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-purple-900 focus:border-transparent transition-all"
          />
        </div>

        {status === "error" && errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm leading-relaxed">{errorMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password || !confirm}
          className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
        >
          {submitting ? (
            <>
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              جاري الحفظ...
            </>
          ) : (
            "حفظ كلمة المرور"
          )}
        </button>
      </form>
    </div>
  );
}
