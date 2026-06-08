import { getAdminLocale } from "@/lib/admin/locale";

/**
 * Admin subtree shell: resolves the admin language and flips direction (RTL for
 * ar, LTR for en) for everything under /admin.
 *
 * The gate lives in each page/server action via requireAdmin() (which redirects
 * non-admins to /admin/login) — NOT here, because the public /admin/login page
 * renders inside this layout and must stay reachable when logged out.
 *
 * force-dynamic: admin views are per-request, auth-gated, and always live —
 * never statically cached or prerendered.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getAdminLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div dir={dir} lang={locale} className="min-h-screen bg-brand-surface text-brand-ink">
      {children}
    </div>
  );
}
