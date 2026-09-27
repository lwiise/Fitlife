import { ChefHat } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { RemoveMemberButton } from "./RemoveMemberButton";
import { LOCALE_INFO, isLocaleCode } from "@/lib/plans/locales";

/**
 * The maid's row on /family (an <li> of the household list). She isn't a plan beneficiary (no goal/macros) — just a
 * name and the language she reads the recipes in — so the card shows that and links
 * to her dedicated edit form (HousekeeperForm via /family/edit/[id]).
 */
export function HousekeeperCard({
  id,
  name,
  preferredLanguage,
  ownerSex,
}: {
  id: string;
  name: string;
  preferredLanguage: string;
  ownerSex?: string | null;
}) {
  const langLabel = isLocaleCode(preferredLanguage)
    ? LOCALE_INFO[preferredLanguage].ar_name
    : null;

  return (
    <li className="flex min-h-16 items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint">
        <ChefHat className="size-4 text-brand-purple-900" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-brand-ink">{name}</p>
        <p className="mt-0.5 truncate text-meta text-brand-ink-muted">
          خدامة{langLabel ? ` · تقرأ بـ ${langLabel}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ButtonLink
          href={`/family/edit/${id}`}
          variant="quiet"
          aria-label={`تعديل ${name}`}
        >
          تعديل
        </ButtonLink>
        <RemoveMemberButton memberId={id} name={name} ownerSex={ownerSex} />
      </div>
    </li>
  );
}
