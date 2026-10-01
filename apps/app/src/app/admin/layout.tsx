import type { Metadata } from "next";
import { getAdminLocale } from "@/lib/admin/locale";
import { consoleLayoutMetadata } from "./_shell/titles";
import "./admin.css";

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

/**
 * The admin's <title>: «لوحة تحكم Fit Life», and «<page> | لوحة تحكم Fit Life»
 * for every page that names itself — never the consumer app's title. Set
 * here, not on the (console) group: a route group's layout shares its segment
 * with the group's own page (/admin), and a template never applies to a page
 * of its own segment.
 */
export function generateMetadata(): Promise<Metadata> {
  return consoleLayoutMetadata();
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getAdminLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div
      dir={dir}
      lang={locale}
      className="admin-root min-h-screen bg-brand-surface text-brand-ink"
    >
      {children}
    </div>
  );
}
