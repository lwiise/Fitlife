"use client";

import { MemberWizard, type MemberWizardInitial } from "../MemberWizard";

export function LactatingWizard(props: {
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
  onboarding?: boolean;
  count?: number;
  onComplete?: () => void;
  onSkip?: () => void;
  ownerSex?: string | null;
}) {
  return <MemberWizard type="lactating" {...props} />;
}
