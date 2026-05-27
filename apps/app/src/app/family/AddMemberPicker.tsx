"use client";

import Link from "next/link";
import { UserPlus, User, Baby, HeartPulse, ChefHat } from "lucide-react";

const OPTIONS: { type: string; label: string; Icon: typeof User }[] = [
  { type: "husband", label: "زوج", Icon: User },
  { type: "adult", label: "بالغ ثاني", Icon: UserPlus },
  { type: "child", label: "طفل", Icon: Baby },
  { type: "preg", label: "امرأة حامل/مرضعة", Icon: HeartPulse },
  { type: "housekeeper", label: "خدامة تطبخ للعائلة", Icon: ChefHat },
];

export function AddMemberPicker() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-dashed border-brand-purple-900/30">
      <p className="font-bold text-brand-ink text-sm mb-3">إضافة فرد جديد</p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <Link
            key={o.type}
            href={`/family/add?type=${o.type}`}
            className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-brand-ink/10 bg-brand-surface/50 px-4 py-3 text-sm font-bold text-brand-ink hover:border-brand-purple-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
          >
            <o.Icon className="size-4 text-brand-purple-900" aria-hidden="true" />
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
