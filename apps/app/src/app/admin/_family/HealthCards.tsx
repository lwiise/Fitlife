import { conditionLabelAr } from "@fitlife/plan-engine";
import type { MemberHealth } from "@/lib/admin/detail";
import { fmtNumber, type AdminLocale } from "@/lib/admin/format";
import { t } from "@/lib/admin/i18n";
import { memberRoleLabel } from "../_blocks/helpers";
import { KvItem } from "../_ui";
import { listToStrings, yesNo } from "./model";

/**
 * The audited health page's body (the prototype's health cards): one card per
 * person, owner first, with every field the old page showed — pregnant (the
 * owner only; members record pregnancy by member type), trimester, months
 * postpartum, high-risk pregnancy, doctor consulted — then the medical
 * conditions, allergies and dislikes. Values are as stored; a condition slug
 * reads by its Arabic name in the Arabic console (unknown values, such as the
 * free-text «حالة أخرى», stay as written).
 */
export function HealthCards({
  members,
  locale,
}: {
  members: readonly MemberHealth[];
  locale: AdminLocale;
}) {
  return (
    <div className="ad-health-grid">
      {members.map((member) => (
        <HealthCard key={member.id} member={member} locale={locale} />
      ))}
    </div>
  );
}

function HealthCard({ member, locale }: { member: MemberHealth; locale: AdminLocale }) {
  const titleId = `ad-health-${member.id}`;
  const number = (n: number | null) => (n == null ? "—" : fmtNumber(n, locale));
  const conditions = member.medicalConditions.map((c) =>
    locale === "ar" ? conditionLabelAr(c) : c,
  );
  return (
    <article className="ad-hcard" aria-labelledby={titleId}>
      <h2 id={titleId}>
        <bdi>{member.name}</bdi> — {memberRoleLabel(member.role, member.role === "housekeeper", locale)}
      </h2>
      <dl className="ad-kv">
        {member.id === "mom" ? (
          <KvItem label={t("field_pregnant", locale)}>{yesNo(member.isPregnant, locale)}</KvItem>
        ) : null}
        <KvItem label={t("field_trimester", locale)}>{number(member.trimester)}</KvItem>
        <KvItem label={t("field_postpartum", locale)}>{number(member.monthsPostpartum)}</KvItem>
        <KvItem label={t("field_high_risk", locale)}>
          {yesNo(member.highRiskPregnancy, locale)}
        </KvItem>
        <KvItem label={t("field_consulted", locale)}>{yesNo(member.consultedDoctor, locale)}</KvItem>
      </dl>
      <div className="ad-hstack">
        <HealthList label={t("field_conditions", locale)} items={conditions} locale={locale} />
        <HealthList
          label={t("field_allergies", locale)}
          items={listToStrings(member.allergies)}
          locale={locale}
        />
        <HealthList
          label={t("field_dislikes", locale)}
          items={listToStrings(member.dislikes)}
          locale={locale}
        />
      </div>
    </article>
  );
}

function HealthList({
  label,
  items,
  locale,
}: {
  label: string;
  items: readonly string[];
  locale: AdminLocale;
}) {
  return (
    <div>
      <p className="ad-label">{label}</p>
      {items.length === 0 ? (
        <span className="ad-muted">{t("none_listed", locale)}</span>
      ) : (
        <ul className="ad-hlist">
          {items.map((item, i) => (
            // What the family typed — its own direction, whatever the console's.
            <li key={`${i}-${item}`}>
              <span dir="auto">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
