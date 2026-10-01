"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthErrorKind = "credentials" | "unconfirmed" | "generic";

/**
 * The form's text, resolved through t() by the (server) login page — so the
 * sign-in page does not ship the admin dictionary to the browser.
 */
export interface AdminLoginLabels {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  signIn: string;
  signingIn: string;
  noAccessTitle: string;
  noAccessBody: string;
  signOut: string;
  errors: Record<AuthErrorKind, string>;
}

function authError(message: string): AuthErrorKind {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "credentials";
  if (m.includes("email not confirmed")) return "unconfirmed";
  return "generic";
}

/**
 * Admin sign-in (sign-in only — admins are seeded, never self-registered).
 * Authenticates with the browser Supabase client, then hard-navigates to /admin
 * so the server gate re-checks admin_users with the fresh session cookie. If the
 * signed-in account isn't an admin, the gate sends them back here in the denied
 * state.
 */
export function AdminLoginForm({
  labels,
  deniedEmail,
}: {
  labels: AdminLoginLabels;
  deniedEmail?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKind | null>(null);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard navigation on purpose: the session cookie just changed and the
    // server must re-evaluate it; a client-side push would keep stale RSC state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin/login");
  }

  // Logged in, but not an admin.
  if (deniedEmail) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-extrabold text-brand-ink">
          {labels.noAccessTitle}
        </h1>
        <p className="mt-2 text-sm leading-7 text-brand-ink-muted">
          {labels.noAccessBody}
        </p>
        <p className="mt-1 text-sm text-brand-ink-muted" dir="ltr">
          {deniedEmail}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-brand-purple-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-700"
        >
          {labels.signOut}
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
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/admin");
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold leading-tight text-brand-ink">
          {labels.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brand-ink-muted">
          {labels.subtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="mb-2 block text-sm font-bold text-brand-ink">
            {labels.email}
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
            className="h-11 w-full rounded-lg border border-brand-ink/10 bg-brand-surface px-4 text-brand-ink transition-all placeholder:text-brand-ink-muted/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-900"
          />
        </div>

        <div>
          <label
            htmlFor="admin-password"
            className="mb-2 block text-sm font-bold text-brand-ink"
          >
            {labels.password}
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
            className="h-11 w-full rounded-lg border border-brand-ink/10 bg-brand-surface px-4 text-brand-ink transition-all placeholder:text-brand-ink-muted/40 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-purple-900"
          />
        </div>

        {errorKey ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3" role="alert">
            <p className="text-sm leading-relaxed text-red-700">{labels.errors[errorKey]}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-purple-900 py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-purple-700 disabled:cursor-not-allowed disabled:bg-brand-purple-900/40 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {labels.signingIn}
            </>
          ) : (
            labels.signIn
          )}
        </button>
      </form>
    </div>
  );
}
