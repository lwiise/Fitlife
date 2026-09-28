import Link from "next/link";
import { genderPick } from "@/lib/copy/gender";
import { ChevronLeft, ClipboardList, Dumbbell, LineChart, Mail, UserPlus } from "lucide-react";

export interface NextStep {
  id: "family" | "workout" | "deep-dive";
  title: string;
  /** Facts separated by « | » render with a rule between them. */
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
    { href: "/recap", icon: Mail, eyebrow: null, title: "رسالتكم الأسبوعية", meta: "ملخّص أسبوعكم" },
    { href: "/journey", icon: LineChart, eyebrow: null, title: "الوزن والمتابعة", meta: "سجلّ خاص بكم" },
  ];
  return (
    <nav aria-label="المزيد" className="kt-more">
      <ul>
        {rows.map(({ href, icon: Icon, eyebrow, title, meta }) => (
          <li key={href}>
            <Link href={href}>
              <span className="mi">
                <Icon className="i" aria-hidden="true" />
              </span>
              <span className="mt">
                {eyebrow && <em>{eyebrow}</em>}
                <strong>{title}</strong>
                <small>
                  {meta.split(" | ").map((part, i) => (
                    <span key={i}>
                      {i > 0 && <i className="sep" aria-hidden="true" />}
                      {part}
                    </span>
                  ))}
                </small>
              </span>
              <ChevronLeft className="i chev" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
