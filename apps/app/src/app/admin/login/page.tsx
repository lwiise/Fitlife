import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import { getAdminLocale } from "@/lib/admin/locale";
import { AdminLoginForm } from "../_components/AdminLoginForm";

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
          <AdminLoginForm locale={locale} deniedEmail={user?.email ?? null} />
        </div>
      </div>
    </main>
  );
}
