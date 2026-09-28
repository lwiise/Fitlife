import Link from "next/link";
import { genderPick } from "@/lib/copy/gender";
import { ChevronLeft, ClipboardList, Dumbbell, LineChart, Mail, UserPlus } from "lucide-react";

export interface NextStep {
  id: "family" | "workout" | "deep-dive";
  title: string;
  meta: string;
  href: string;
}

const STEP_ICON = { family: UserPlus, workout: Dumbbell, "deep-dive": ClipboardList } as const;

/**
 * The doors that are NOT in the tab bar or account menu's first reach: the one
 * next step (when there is one), the weekly letter and the private weight
 * record. Replaces the 2×2 quick tiles, which repeated the tab bar.
 */
export function MoreCard({
  nextStep,
  ownerSex,
}: {
  nextStep: NextStep | null;
  ownerSex: string | null;
}) {
  const g = genderPick(ownerSex);
  const rows = [
    ...(nextStep
      ? [{ href: nextStep.href, icon: STEP_ICON[nextStep.id], eyebrow: g("خطوتكِ التالية", "خطوتك التالية"), title: nextStep.title, meta: nextStep.meta }]
      : []),
    { href: "/recap", icon: Mail, eyebrow: null, title: "رسالتكم الأسبوعية", meta: "ملخّص أسبوعكم في البيت" },
    { href: "/journey", icon: LineChart, eyebrow: null, title: "الوزن والمتابعة", meta: "سجلّ خاص بكم، لا يظهر في الموسم" },
  ];
  return (
    <nav aria-label="المزيد" className="overflow-hidden rounded-[1.375rem] border border-brand-line bg-brand-card">
      <ul className="divide-y divide-brand-line">
        {rows.map(({ href, icon: Icon, eyebrow, title, meta }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple-900 sm:px-5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint">
                <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                {eyebrow && <span className="block text-meta font-bold text-brand-purple-900">{eyebrow}</span>}
                <span className="block text-base font-bold text-brand-ink">{title}</span>
                <span className="mt-0.5 block text-meta text-brand-ink-muted">{meta}</span>
              </span>
              <ChevronLeft className="size-5 shrink-0 text-brand-ink-muted group-hover:text-brand-purple-900" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
