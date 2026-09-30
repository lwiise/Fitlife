import type { ReactNode } from "react";
import {
  getCurrentUserProfile,
  getCurrentUserProfilePhotos,
} from "@/lib/supabase/queries";
import { OWNER_PHOTO_SUBJECT, profilePhotoSrc } from "@/lib/profilePhoto/shared";
import { AppShell } from "./AppShell";

/**
 * The layout every signed-in section uses (dashboard, plan, family, profile,
 * journey, chat, recap, settings, subscription): one header + navigation.
 * The profile and photo reads are React.cache'd, so pages that also read them
 * pay nothing.
 */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const [profile, photos] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentUserProfilePhotos(),
  ]);
  return (
    <AppShell
      displayName={profile?.display_name ?? null}
      photoSrc={profilePhotoSrc(photos[OWNER_PHOTO_SUBJECT])}
    >
      {children}
    </AppShell>
  );
}
