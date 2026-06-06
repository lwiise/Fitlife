"use client";

import { MemberWizard, type MemberWizardInitial } from "../MemberWizard";

export function PregnantWizard(props: {
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
  onboarding?: boolean;
  count?: number;
  onComplete?: () => void;
}) {
  return <MemberWizard type="pregnant" {...props} />;
}
