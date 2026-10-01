import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { getAdminLocale } from "@/lib/admin/locale";
import { AdminLoginForm, type AdminLoginLabels } from "../_components/AdminLoginForm";

/** The form's text, resolved here so the client form never imports the dictionary. */
function loginLabels(locale: AdminLocale): AdminLoginLabels {
  return {
    title: t("admin_login_title", locale),
    subtitle: t("admin_login_subtitle", locale),
    email: t("field_email", locale),
    password: t("field_password", locale),
    signIn: t("action_sign_in", locale),
    signingIn: t("signing_in", locale),
    noAccessTitle: t("no_access_title", locale),
    noAccessBody: t("no_access_body", locale),
    signOut: t("action_sign_out", locale),
    errors: {
      credentials: t("login_error_credentials", locale),
      unconfirmed: t("login_error_unconfirmed", locale),
      generic: t("login_error_generic", locale),
    },
  };
}

/**
 * Admin sign-in page. Public (this is the one /admin route that doesn't gate) —
 * which is why the panel's existence is visible here, a deliberate trade-off vs
 * the original stealth-404 model. Already-admins are bounced straight to the
 * dashboard; logged-in non-admins see a "no access" state.
 */
export default async function AdminLoginPage() {
  const ctx = await getAdminContext();
  if (ctx) redirect("/admin");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getAdminLocale();

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-brand-purple-900 text-base font-extrabold text-white"
          >
            FL
          </span>
        </div>
        <div className="rounded-xl border border-brand-ink/10 bg-surface-elevated p-6 shadow-sm">
          <AdminLoginForm labels={loginLabels(locale)} deniedEmail={user?.email ?? null} />
        </div>
      </div>
    </main>
  );
}
