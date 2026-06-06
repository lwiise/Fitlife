"use client";

import { MemberWizard, type MemberWizardInitial } from "../MemberWizard";

export function LactatingWizard(props: {
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
  onboarding?: boolean;
}) {
  return <MemberWizard type="lactating" {...props} />;
}
