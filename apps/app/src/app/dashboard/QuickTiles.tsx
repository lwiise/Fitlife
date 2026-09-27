import Link from "next/link";
import { LineChart, Mail, Sparkles, Users } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";

/** One-tap doors to the rest of the app — the advisor, the weekly letter,
 * the private weight record and the household. */
export function QuickTiles({
  ownerSex,
  familySize,
  hasHousekeeper,
}: {
  ownerSex: string | null;
  /** Beneficiaries including the owner. */
  familySize: number;
  hasHousekeeper: boolean;
}) {
  const g = genderPick(ownerSex);
  const family =
    familySize > 1
      ? `${arNum(familySize)} أفراد${hasHousekeeper ? " ومن يطبخ" : ""}`
      : g("أضيفي أفراد بيتكِ", "أضف أفراد بيتك");
  const tiles = [
    { href: "/chat", icon: Sparkles, title: "المستشارة", sub: g("اسألي عن بديل أو مقدار", "اسأل عن بديل أو مقدار") },
    { href: "/recap", icon: Mail, title: "رسالتكم الأسبوعية", sub: "ملخّص أسبوعكم" },
    { href: "/journey", icon: LineChart, title: "الوزن والمتابعة", sub: "سجلّ خاص بكم" },
    { href: "/family", icon: Users, title: "العائلة", sub: family },
  ];
  return (
    <nav aria-label="اختصارات" className="grid grid-cols-2 gap-3">
      {tiles.map(({ href, icon: Icon, title, sub }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-24 flex-col gap-1 rounded-[1.375rem] border border-brand-line bg-brand-card p-4 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
        >
          <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
          <b className="mt-1 text-base font-extrabold text-brand-ink">{title}</b>
          <small className="text-meta text-brand-ink-muted">{sub}</small>
        </Link>
      ))}
    </nav>
  );
}
