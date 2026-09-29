import type { FamilyFlag } from "@/lib/admin/console-types";
import type { AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { chipFlags, familyFlagLabel, familyFlagTone } from "./helpers";
import { FlagChip } from "./parts";

/**
 * The family's flags as chips, to sit after the tier tag and status pill
 * (the prototype's `chipFlags`). Past-due is left out because the status pill
 * already says it; the medical gate appears only when the caller passes it
 * (panel and page — never the list). A family with no flag at all reads
 * «لا توجد تنبيهات»; one whose only flag is past-due renders nothing.
 *
 * Returns a fragment: the caller's row (`.ad-sh-chips`, `.ad-chipsrow`)
 * lays the chips out.
 */
export function FamilyFlagChips({
  flags,
  medicalGateBlocked,
  locale,
}: {
  flags: readonly FamilyFlag[];
  medicalGateBlocked: boolean;
  locale: AdminLocale;
}) {
  const chips = chipFlags(flags, medicalGateBlocked);
  if (chips.length === 0) {
    if (flags.length > 0) return null;
    return <FlagChip tone="ok">{t("flags_clear", locale)}</FlagChip>;
  }
  return (
    <>
      {chips.map((flag) => (
        <FlagChip key={flag} tone={familyFlagTone(flag)}>
          {familyFlagLabel(flag, locale)}
        </FlagChip>
      ))}
    </>
  );
}
