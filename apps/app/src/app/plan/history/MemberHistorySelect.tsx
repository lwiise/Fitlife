"use client";

import { useRouter } from "next/navigation";
import { genderPick } from "@/lib/copy/gender";

/**
 * Per-member history lens: pick a family member to browse their own past plans.
 * Navigates to /plan/history?member=<id> (server re-filters).
 */
export function MemberHistorySelect({
  members,
  selected,
  ownerSex,
}: {
  members: { id: string; name: string }[];
  selected: string;
  ownerSex?: string | null;
}) {
  const router = useRouter();

  return (
    <div>
      <label
        htmlFor="history-member"
        className="block text-xs font-bold text-brand-ink-muted mb-1.5"
      >
        {genderPick(ownerSex)("اختاري الفرد", "اختر الفرد")}
      </label>
      <select
        id="history-member"
        value={selected}
        onChange={(e) => router.push(`/plan/history?member=${e.target.value}`)}
        className="w-full sm:w-64 min-h-11 px-4 rounded-xl border border-brand-ink/10 bg-white text-brand-ink text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
