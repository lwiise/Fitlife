import Link from "next/link";
import { ChefHat } from "lucide-react";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { LOCALE_INFO, isLocaleCode } from "@/lib/plans/locales";

/**
 * The maid's row on /family. She isn't a plan beneficiary (no goal/macros) — just a
 * name and the language she reads the recipes in — so the card shows that and links
 * to her dedicated edit form (HousekeeperForm via /family/edit/[id]).
 */
export function HousekeeperCard({
  id,
  name,
  preferredLanguage,
}: {
  id: string;
  name: string;
  preferredLanguage: string;
}) {
  const langLabel = isLocaleCode(preferredLanguage)
    ? LOCALE_INFO[preferredLanguage].ar_name
    : null;

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-brand-ink/5">
      <div className="size-10 rounded-full bg-brand-lavender/30 flex items-center justify-center flex-shrink-0">
        <ChefHat className="size-5 text-brand-purple-900" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-brand-ink truncate">{name}</p>
        <p className="text-brand-ink-muted text-xs mt-0.5">
          خدامة{langLabel ? ` · تقرأ بـ ${langLabel}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          href={`/family/edit/${id}`}
          className="text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md px-1 min-h-11 inline-flex items-center"
        >
          تعديل
        </Link>
        <RemoveMemberButton memberId={id} name={name} />
      </div>
    </div>
  );
}
