import { requireAdmin } from "@/lib/admin/auth";
import { loadConsoleNavData } from "@/lib/admin/consoleNav";
import { getAdminCurrency, getAdminLocale } from "@/lib/admin/locale";
import { ConsoleFrame } from "../_shell/ConsoleFrame";
import { toShellNav, type ShellNav } from "../_shell/navData";

/**
 * Everything an operator sees after signing in lives in this group; the login
 * page sits outside it. The frame (top bar, rail, command palette) mounts
 * here. Every page and route handler still calls requireAdmin() itself —
 * a layout is not re-run on client-side navigation, so it cannot be the only
 * gate.
 *
 * The nav data (the rail counts — no family's name or email; ⌘K fetches its
 * index from the audited GET /api/admin/families when it opens) is started
 * here but NOT awaited: the frame paints immediately and the counts stream
 * in. A failed load resolves to null — the rail shows no counts and says so —
 * instead of taking every console page down with it.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const [locale, currency] = await Promise.all([getAdminLocale(), getAdminCurrency()]);

  const nav: Promise<ShellNav | null> = loadConsoleNavData()
    .then((data) => toShellNav(data, locale))
    .catch((error: unknown) => {
      console.error("[admin] console nav data failed", error);
      return null;
    });

  return (
    <ConsoleFrame locale={locale} currency={currency} adminEmail={admin.email} nav={nav}>
      {children}
    </ConsoleFrame>
  );
}
