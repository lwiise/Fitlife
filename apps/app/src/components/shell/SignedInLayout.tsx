import type { ReactNode } from "react";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { AppShell } from "./AppShell";

/**
 * The layout every signed-in section uses (dashboard, plan, family, profile,
 * journey, chat, recap, settings, subscription): one header + navigation.
 * The profile read is React.cache'd, so pages that also read it pay nothing.
 */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const profile = await getCurrentUserProfile();
  return <AppShell displayName={profile?.display_name ?? null}>{children}</AppShell>;
}
