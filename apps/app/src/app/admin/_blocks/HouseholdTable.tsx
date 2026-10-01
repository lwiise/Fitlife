import type { HouseholdMember } from "@/lib/admin/console-types";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { goalLabel, t } from "@/lib/admin/i18n";
import { joinSep } from "../_ui/Sep";
import { isPlannedByPortions, macrosText, memberRoleLabel } from "./helpers";
import { FlagChip, TableScroll } from "./parts";

/** Marks a child's figure as the engine's estimate, not a target. */
const APPROX = "≈ ";

/** A member's flags: medical gate (a boolean only), picky eater, the cook. */
function memberFlags(m: HouseholdMember, locale: AdminLocale) {
  if (!m.medicalGate && !m.pickyEater && !m.isHousekeeper) return null;
  return (
    <>
      {m.medicalGate ? (
        <>
          <FlagChip tone="crit">{t("flag_medical_gate", locale)}</FlagChip>{" "}
        </>
      ) : null}
      {m.pickyEater ? (
        <>
          <FlagChip tone="neu">{t("flag_picky", locale)}</FlagChip>{" "}
        </>
      ) : null}
      {m.isHousekeeper ? <FlagChip tone="neu">{t("fm_role_cook", locale)}</FlagChip> : null}
    </>
  );
}

/**
 * The household, owner first (the prototype's `householdTable`): name with
 * role (and a child's age), goal, daily calories, macros P/C/F, and flags —
 * medical gate (a boolean only; the detail stays on the audited health
 * page), picky eater, the cook.
 *
 * Narrow places — the 440px side panel, a phone — cannot fit five columns.
 * There the flags move under each member's name (a container query on
 * `.ad-hh` swaps the two renderings, so only one is ever displayed or read
 * out) and the macros heading wraps, so the medical-gate flag is on screen
 * without scrolling; whatever still overflows scrolls sideways, keyboard
 * included (TableScroll).
 *
 * A child is planned by PORTIONS: the calorie and macro figures on its plan
 * header are the engine's rough estimate, not a target, so they read «≈ …»
 * with «بالحصص» rather than as a number the family is held to. "Child" is the
 * engine's rule (`isPlannedByPortions`: member_type child OR under 18), so an
 * under-18 owner or a minor saved as an adult reads the same way.
 */
export function HouseholdTable({
  members,
  locale,
}: {
  members: readonly HouseholdMember[];
  locale: AdminLocale;
}) {
  if (members.length === 0) return <div className="ad-empty">{t("no_members", locale)}</div>;
  return (
    <TableScroll label={t("section_household", locale)} className="ad-hh">
      <thead>
        <tr>
          <th scope="col">{t("fm_col_member", locale)}</th>
          <th scope="col">{t("field_goal", locale)}</th>
          <th scope="col" className="ad-end">
            {t("field_calories", locale)}
          </th>
          <th scope="col" className="ad-hh-macros">
            {t("fm_macros_head", locale)}
          </th>
          <th scope="col" className="ad-hh-flags">
            {t("section_flags", locale)}
          </th>
        </tr>
      </thead>
      <tbody>
        {members.map((m) => {
          const child = isPlannedByPortions(m);
          const role = memberRoleLabel(m.role, m.isHousekeeper, locale);
          const flags = memberFlags(m, locale);
          return (
            <tr key={m.id}>
              <td>
                <b>
                  <bdi>{m.name}</bdi>
                </b>{" "}
                <span className="ad-sub">
                  {joinSep(role, child && m.age != null ? fmtNumber(m.age, locale) : null)}
                </span>
                {flags ? <span className="ad-hh-flags-in">{flags}</span> : null}
              </td>
              <td>{m.isHousekeeper ? "—" : goalLabel(m.primaryGoal, locale)}</td>
              <td className="ad-end ad-num">
                {child ? (
                  <>
                    {m.caloriesTarget != null ? (
                      <span title={t("fm_approx", locale)}>
                        {APPROX}
                        {fmtNumber(Math.round(m.caloriesTarget), locale)}{" "}
                      </span>
                    ) : null}
                    <span className="ad-muted">{t("fm_portions_short", locale)}</span>
                  </>
                ) : m.caloriesTarget != null ? (
                  fmtNumber(Math.round(m.caloriesTarget), locale)
                ) : (
                  "—"
                )}
              </td>
              <td className="ad-num ad-muted ad-nowrap">
                {m.macros ? `${child ? APPROX : ""}${macrosText(m.macros, locale)}` : "—"}
              </td>
              <td className="ad-hh-flags">{flags}</td>
            </tr>
          );
        })}
      </tbody>
    </TableScroll>
  );
}
