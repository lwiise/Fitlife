import { redirect } from "next/navigation";
import { clsx } from "clsx";
import { CalendarDays, Lock, UtensilsCrossed, Users, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchWeeklyRecap, type WeeklyRecap } from "@/lib/engagement/recap";
import { ShareWeekButton } from "./ShareWeekButton";
import { genderPick } from "@/lib/copy/gender";
import { arNum } from "@/lib/copy/numbers";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = {
  title: "رسالتك الأسبوعية — فت لايف",
  robots: { index: false, follow: false },
};

// Weight keeps its decimals (arNum rounds to an integer, which is right for
// the counts but would turn a 0.4 kg change into «٠»).
const AR_DECIMAL = new Intl.NumberFormat("ar-SA", { useGrouping: false });

// Riyadh-anchored weekday initial for a YYYY-MM-DD (RTL strip labels).
function dayInitial(dateISO: string): string {
  const names = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // getUTCDay: 0=Sun
  return names[new Date(`${dateISO}T00:00:00Z`).getUTCDay()] ?? "";
}

// The letter body — deterministic فصحى built ONLY from computed numbers
// (no model call in v1; every sentence is backed by a real count). Addresses
// the account OWNER, so it follows the owner's sex (g).
function letterLines(
  recap: WeeklyRecap,
  g: (feminine: string, masculine: string) => string,
): string[] {
  if (recap.baseline) {
    return [
      g(
        "هذا أسبوعكِ الأول مع سجلّ المائدة — اعتبريه أساساً نقيس عليه.",
        "هذا أسبوعك الأول مع سجلّ المائدة — اعتبره أساساً نقيس عليه.",
      ),
      g(
        "حين تغلقين أيامك، تتحول إجاباتك إلى خطة تشبه بيتك أكثر كل أسبوع.",
        "حين تغلق أيامك، تتحول إجاباتك إلى خطة تشبه بيتك أكثر كل أسبوع.",
      ),
    ];
  }
  const lines: string[] = [];
  if (recap.cooked_days > 0) {
    lines.push(
      `${g("هذا الأسبوع قامت سفرتكِ من مطبخكِ", "هذا الأسبوع قامت سفرتك من مطبخك")} ${arNum(recap.cooked_days)} ${recap.cooked_days === 1 ? "يوماً" : "أيام"}.`,
    );
  }
  if (recap.guest_days > 0) {
    lines.push(
      recap.guest_days === 1
        ? g("وليلة كرمٍ أضاءت بيتكِ — الضيف له المقام.", "وليلة كرمٍ أضاءت بيتك — الضيف له المقام.")
        : `و${arNum(recap.guest_days)} ${g("ليالي كرمٍ أضاءت بيتكِ.", "ليالي كرمٍ أضاءت بيتك.")}`,
    );
  }
  if (recap.top_dish) {
    lines.push(`${g("طبق الأسبوع عندكِ", "طبق الأسبوع عندك")}: «${recap.top_dish.recipe_name_ar}».`);
  }
  if (lines.length === 0) {
    lines.push(
      g(
        "أسبوع هادئ — وخطة الأسبوع القادم جاهزة متى ما كنتِ مستعدة.",
        "أسبوع هادئ — وخطة الأسبوع القادم جاهزة متى ما كنت مستعداً.",
      ),
    );
  }
  return lines;
}

/** The noun beside a figure shown on its own: 1 / 2 / 3-10 / 11+ agreement
 * («لغتان» used to label three languages too). */
function arCountLabel(n: number, [one, two, few, many]: [string, string, string, string]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return few;
  return many;
}

export default async function RecapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [recap, { data: ownerProfile }] = await Promise.all([
    fetchWeeklyRecap(supabase, user.id),
    supabase.from("profiles").select("sex").eq("id", user.id).single(),
  ]);
  const ownerSex = (ownerProfile as { sex?: string | null } | null)?.sex ?? null;
  const g = genderPick(ownerSex);

  return (
    <main dir="rtl" className="container-shell py-6 lg:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          className="mb-0"
          title="رسالتك الأسبوعية"
          description="ملخّص أسبوع بيتكم من سارة، مبنيّ على أرقامكم فقط."
        />

        {!recap ? (
          <Card className="space-y-4">
            <p className="text-base leading-relaxed text-brand-ink-muted">
              رسالتك الأولى تصدر بعد أول خطة أسبوعية لبيتك.
            </p>
            <ButtonLink href="/plan">{g("افتحي خطتك", "افتح خطتك")}</ButtonLink>
          </Card>
        ) : (
          <>
            {/* The letter */}
            <Card aria-label="رسالة الأسبوع" className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-full bg-brand-purple-900 font-extrabold text-white"
                >
                  س
                </span>
                <div>
                  <p className="text-app-item text-brand-ink">من سارة</p>
                  <p className="text-meta text-brand-ink-muted">
                    أسبوع {new Date(`${recap.week_start}T00:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-base leading-loose text-brand-ink">
                {letterLines(recap, g).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              {/* Week strip — gold = hospitality honored, purple = cooked */}
              <ul className="m-0 flex list-none gap-1.5 p-0" aria-label="أيام الأسبوع">
                {recap.day_cells.map((cell) => {
                  const stateLabel =
                    cell.state === "guest"
                      ? "يوم كرم"
                      : cell.state === "cooked"
                        ? "طُبخ من الخطة"
                        : cell.state === "logged"
                          ? "يوم مسجل"
                          : "بلا تسجيل";
                  return (
                    <li
                      key={cell.local_date}
                      title={cell.local_date}
                      className={clsx(
                        "flex size-10 items-center justify-center rounded-xl text-[13px] font-bold",
                        cell.state === "guest" && "border border-gold-line bg-gold-soft text-brand-ink",
                        cell.state === "cooked" && "bg-brand-purple-900 text-white",
                        cell.state === "logged" && "bg-brand-tint text-brand-purple-900",
                        cell.state !== "guest" &&
                          cell.state !== "cooked" &&
                          cell.state !== "logged" &&
                          "border border-dashed border-brand-ink/20 text-brand-ink-muted",
                      )}
                    >
                      <span aria-hidden="true">{dayInitial(cell.local_date)}</span>
                      <span className="sr-only">{`${cell.local_date}: ${stateLabel}`}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-meta text-brand-ink-muted">
                {g("الذهبي يوم كرم — يُحسب لكِ، لا عليكِ.", "الذهبي يوم كرم — يُحسب لك، لا عليك.")}
              </p>
            </Card>

            {/* The receipt — real counts only */}
            <section aria-label="حصاد الأسبوع">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: UtensilsCrossed,
                    value: arNum(recap.meals_planned),
                    label: "وجبة مخططة",
                  },
                  {
                    icon: Users,
                    value: arNum(recap.members_count),
                    label: recap.members_count === 1 ? "خطة شخصية" : "أفراد",
                  },
                  {
                    icon: Languages,
                    value: arNum(recap.languages_count),
                    label: arCountLabel(recap.languages_count, ["لغة", "لغتان", "لغات", "لغة"]),
                  },
                  {
                    icon: CalendarDays,
                    value: arNum(recap.logged_days),
                    label: arCountLabel(recap.logged_days, ["يوم مسجّل", "يومان مسجّلان", "أيام مسجّلة", "يوماً مسجّلاً"]),
                  },
                ].map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1 rounded-[1.375rem] border border-brand-line bg-brand-card p-4"
                  >
                    <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
                    <p className="mt-1 text-2xl font-extrabold leading-tight text-brand-ink">
                      {value}
                    </p>
                    <p className="text-meta text-brand-ink-muted">{label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Private line — never part of the share surface */}
            {recap.weight_delta_kg !== null && (
              <Card as="aside" tone="tint" aria-label="سطر خاص" className="flex items-start gap-3">
                <Lock className="mt-1 size-4 shrink-0 text-brand-purple-900" aria-hidden="true" />
                <p className="text-[15px] leading-relaxed text-brand-ink">
                  {g("بينكِ وبين نفسكِ", "بينك وبين نفسك")}: وزنك تغيّر{" "}
                  <span className="font-bold" dir="ltr">
                    {AR_DECIMAL.format(Math.abs(recap.weight_delta_kg))}
                  </span>{" "}
                  كجم هذا الأسبوع. هذا السطر لا يظهر عند المشاركة.
                </p>
              </Card>
            )}

            <div className="space-y-2">
              <ShareWeekButton
                cookedDays={recap.cooked_days}
                guestDays={recap.guest_days}
                ownerSex={ownerSex}
              />
              <p className="text-center text-meta text-brand-ink-muted">
                تُشارك الأرقام العامة فقط، بلا وزن ولا تفاصيل صحية.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
