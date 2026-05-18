"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect_to") || "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message || "حصل خطأ. حاولي مرة ثانية.");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-emerald/10 mb-4">
          <Mail className="size-7 text-brand-emerald" />
        </div>
        <h3 className="font-bold text-lg text-brand-ink mb-2">
          تفقدي إيميلك
        </h3>
        <p className="text-brand-ink-muted text-sm leading-relaxed">
          أرسلنا رابط دخول إلى<br />
          <span className="font-semibold text-brand-ink">{email}</span>
        </p>
        <p className="mt-4 text-brand-ink-muted/60 text-xs leading-relaxed">
          الرابط صالح لمدة ساعة. لو ما وصل، تفقدي مجلد السبام.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="mt-6 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold underline underline-offset-4"
        >
          استخدمي إيميل ثاني
        </button>
      </div>
    );
  }

  return (
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
          disabled={status === "sending"}
          autoComplete="email"
          dir="ltr"
          placeholder="you@example.com"
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
        disabled={status === "sending" || !email}
        className="w-full flex items-center justify-center gap-2 bg-brand-ink hover:bg-brand-purple-900 disabled:bg-brand-ink/40 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-lg disabled:cursor-not-allowed disabled:shadow-none"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            جاري الإرسال...
          </>
        ) : (
          "أرسلي لي رابط الدخول"
        )}
      </button>
    </form>
  );
}
