import { requireAdmin } from "@/lib/admin/auth";
import { getAdminLocale } from "@/lib/admin/locale";

/**
 * Outer gate for the entire /admin subtree (defense-in-depth layer 1).
 * `requireAdmin()` resolves the session user and checks admin_users via the
 * service-role client; non-admins get notFound() → 404. Every admin route
 * handler / server action repeats the check (layer 2) — never rely on this
 * layout alone.
 *
 * force-dynamic: admin views are per-request, auth-gated, and always live —
 * they must never be statically cached or prerendered.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate (defense-in-depth layer 1), then resolve the admin language so the
  // whole subtree flips direction (RTL for ar, LTR for en) at the layout level.
  await requireAdmin();
  const locale = await getAdminLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={dir} lang={locale} className="min-h-screen bg-brand-surface text-brand-ink">
      {children}
    </div>
  );
}
