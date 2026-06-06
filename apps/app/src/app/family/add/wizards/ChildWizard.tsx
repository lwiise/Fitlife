"use client";

import { MemberWizard, type MemberWizardInitial } from "../MemberWizard";

export function ChildWizard(props: {
  role: string;
  editMemberId?: string;
  initial?: MemberWizardInitial;
  onboarding?: boolean;
  count?: number;
}) {
  return <MemberWizard type="child" {...props} />;
}
