"use client";

import { useRouter } from "next/navigation";
import { UserPlus, User, Baby, HeartPulse, ChefHat } from "lucide-react";

type Option = {
  type: string;
  label: string;
  Icon: typeof User;
};

const OPTIONS: Option[] = [
  { type: "husband", label: "زوج", Icon: User },
  { type: "housekeeper", label: "خدامة تطبخ للعائلة", Icon: ChefHat },
  { type: "adult", label: "بالغ ثاني", Icon: UserPlus },
  { type: "child", label: "طفل", Icon: Baby },
  { type: "preg", label: "امرأة حامل/مرضعة", Icon: HeartPulse },
];

export function AddMemberPicker() {
  const router = useRouter();

  // Warm the (dynamic) destination on intent — hover on desktop, first touch on
  // mobile — so the server render is already in flight when the click commits.
  const prefetch = (type: string) => router.prefetch(`/family/add?type=${type}`);

  return (
    <div className="bg-white rounded-2xl p-5 border border-dashed border-brand-purple-900/30">
      <p className="font-bold text-brand-ink text-sm mb-3">إضافة فرد جديد</p>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            type="button"
            onPointerEnter={() => prefetch(o.type)}
            onTouchStart={() => prefetch(o.type)}
            onFocus={() => prefetch(o.type)}
            onClick={() => router.push(`/family/add?type=${o.type}`)}
            className="w-full inline-flex items-center gap-2 min-h-11 rounded-xl border border-brand-ink/10 bg-brand-surface/50 px-4 py-3 text-start text-sm font-bold text-brand-ink hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            <o.Icon className="size-4 text-brand-purple-900 flex-shrink-0" aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
