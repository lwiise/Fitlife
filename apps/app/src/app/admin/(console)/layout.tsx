import { requireAdmin } from "@/lib/admin/auth";

/**
 * Everything an operator sees after signing in lives in this group; the login
 * page sits outside it. The frame (top bar, rail, command palette) mounts
 * here. Every page and route handler still calls requireAdmin() itself —
 * a layout is not re-run on client-side navigation, so it cannot be the only
 * gate.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return <>{children}</>;
}
