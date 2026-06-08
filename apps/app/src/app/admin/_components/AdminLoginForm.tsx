"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";

function authError(message: string): "login_error_credentials" | "login_error_unconfirmed" | "login_error_generic" {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "login_error_credentials";
  if (m.includes("email not confirmed")) return "login_error_unconfirmed";
  return "login_error_generic";
}

/**
 * Admin sign-in (sign-in only — admins are seeded, never self-registered).
 * Authenticates with the browser Supabase client, then hard-navigates to /admin
 * so the server gate re-checks admin_users with the fresh session cookie. If the
 * signed-in account isn't an admin, the gate sends them back here in the denied
 * state.
 */
export function AdminLoginForm({
  locale,
  deniedEmail,
}: {
  locale: AdminLocale;
  deniedEmail?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<
    "login_error_credentials" | "login_error_unconfirmed" | "login_error_generic" | null
  >(null);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  // Logged in, but not an admin.
  if (deniedEmail) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-extrabold text-brand-ink">
          {t("no_access_title", locale)}
        </h1>
        <p className="mt-2 text-sm leading-7 text-brand-ink-muted">
          {t("no_access_body", locale)}
        </p>
        <p className="mt-1 text-sm text-brand-ink-muted" dir="ltr">
          {deniedEmail}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-purple-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-700"
        >
          {t("action_sign_out", locale)}
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrorKey(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorKey(authError(error.message));
      setSubmitting(false);
      return;
    }

    // Hard navigation so the server picks up the freshly-set session cookie.
    window.location.assign("/admin");
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold leading-tight text-brand-ink">
          {t("admin_login_title", locale)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-ink-muted">
          {t("admin_login_subtitle", locale)}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="mb-2 block text-sm font-bold text-brand-ink">
            {t("field_email", locale)}
          </label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={submitting}
            autoComplete="email"
            dir="ltr"
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border border-brand-ink/10 bg-brand-surface px-4 text-brand-ink transition-all placeholder:text-brand-ink-muted/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-900"
          />
        </div>

        <div>
          <label
            htmlFor="admin-password"
            className="mb-2 block text-sm font-bold text-brand-ink"
          >
            {t("field_password", locale)}
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={submitting}
            autoComplete="current-password"
            dir="ltr"
            placeholder="********"
            className="h-11 w-full rounded-xl border border-brand-ink/10 bg-brand-surface px-4 text-brand-ink transition-all placeholder:text-brand-ink-muted/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-900"
          />
        </div>

        {errorKey ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3" role="alert">
            <p className="text-sm leading-relaxed text-red-700">{t(errorKey, locale)}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-ink py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-purple-900 disabled:cursor-not-allowed disabled:bg-brand-ink/40 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t("signing_in", locale)}
            </>
          ) : (
            t("action_sign_in", locale)
          )}
        </button>
      </form>
    </div>
  );
}
