import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Lock, UtensilsCrossed, Users, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchWeeklyRecap, type WeeklyRecap } from "@/lib/engagement/recap";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { ShareWeekButton } from "./ShareWeekButton";

export const metadata = {
  title: "رسالتك الأسبوعية — فت لايف",
  robots: { index: false, follow: false },
};

const AR_NUM = new Intl.NumberFormat("ar-SA", { useGrouping: false });

// Riyadh-anchored weekday initial for a YYYY-MM-DD (RTL strip labels).
function dayInitial(dateISO: string): string {
  const names = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // getUTCDay: 0=Sun
  return names[new Date(`${dateISO}T00:00:00Z`).getUTCDay()] ?? "";
}

// The letter body — deterministic فصحى built ONLY from computed numbers
// (no model call in v1; every sentence is backed by a real count).
function letterLines(recap: WeeklyRecap): string[] {
  if (recap.baseline) {
    return [
      "هذا أسبوعكِ الأول مع سجلّ المائدة — اعتبريه أساساً نقيس عليه.",
      "حين تغلقين أيامك، تتحول إجاباتك إلى خطة تشبه بيتك أكثر كل أسبوع.",
    ];
  }
  const lines: string[] = [];
  if (recap.cooked_days > 0) {
    lines.push(
      `هذا الأسبوع قامت سفرتكم من مطبخكم ${AR_NUM.format(recap.cooked_days)} ${recap.cooked_days === 1 ? "يوماً" : "أيام"}.`,
    );
  }
  if (recap.guest_days > 0) {
    lines.push(
      recap.guest_days === 1
        ? "وليلة كرمٍ أضاءت بيتكم — الضيف له المقام."
        : `و${AR_NUM.format(recap.guest_days)} ليالي كرمٍ أضاءت بيتكم.`,
    );
  }
  if (recap.top_dish) {
    lines.push(`طبق الأسبوع عندكم: «${recap.top_dish.recipe_name_ar}».`);
  }
  if (lines.length === 0) {
    lines.push("أسبوع هادئ — وخطة الأسبوع القادم جاهزة متى ما كنتِ مستعدة.");
  }
  return lines;
}

export default async function RecapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const recap = await fetchWeeklyRecap(supabase, user.id);

  return (
    <main dir="rtl" className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <Logo />
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app max-w-2xl py-8 space-y-6">
        <h1 className="text-3xl font-extrabold text-brand-ink">رسالتك الأسبوعية</h1>

        {!recap ? (
          <section className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-3">
            <p className="text-brand-ink-muted leading-relaxed">
              رسالتك الأولى تصدر بعد أول خطة أسبوعية لبيتك.
            </p>
            <Link
              href="/plan"
              className="inline-flex items-center justify-center min-h-11 px-5 rounded-full bg-brand-purple-900 text-white hover:bg-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
            >
              إلى خطتك
            </Link>
          </section>
        ) : (
          <>
            {/* The letter */}
            <section
              aria-label="رسالة الأسبوع"
              className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-10 rounded-full bg-brand-purple-900 text-white font-extrabold flex items-center justify-center"
                >
                  س
                </span>
                <div>
                  <p className="font-bold text-brand-ink">من سارة</p>
                  <p className="text-xs text-brand-ink-muted">
                    أسبوع {new Date(`${recap.week_start}T00:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" })}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-brand-ink leading-loose">
                {letterLines(recap).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              {/* Week strip — gold = hospitality honored, purple = cooked */}
              <div className="flex gap-1.5" role="img" aria-label="أيام الأسبوع">
                {recap.day_cells.map((cell) => (
                  <span
                    key={cell.local_date}
                    title={cell.local_date}
                    className={
                      "size-9 rounded-lg text-xs font-bold flex items-center justify-center " +
                      (cell.state === "guest"
                        ? "bg-brand-yellow text-brand-ink"
                        : cell.state === "cooked"
                          ? "bg-brand-purple-900 text-white"
                          : cell.state === "logged"
                            ? "bg-brand-lavender/40 text-brand-purple-900"
                            : "border border-dashed border-brand-ink/20 text-brand-ink-muted")
                    }
                  >
                    {dayInitial(cell.local_date)}
                  </span>
                ))}
              </div>
              <p className="text-xs text-brand-ink-muted">
                الذهبي يوم كرم — يُحسب لكِ، لا عليكِ.
              </p>
            </section>

            {/* The receipt — real counts only */}
            <section
              aria-label="حصاد الأسبوع"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                {
                  icon: UtensilsCrossed,
                  value: AR_NUM.format(recap.meals_planned),
                  label: "وجبة مخططة",
                },
                {
                  icon: Users,
                  value: AR_NUM.format(recap.members_count),
                  label: recap.members_count === 1 ? "خطة شخصية" : "أفراد",
                },
                {
                  icon: Languages,
                  value: AR_NUM.format(recap.languages_count),
                  label: recap.languages_count === 1 ? "لغة" : "لغتان",
                },
                {
                  icon: CalendarDays,
                  value: AR_NUM.format(recap.logged_days),
                  label: "أيام مسجلة",
                },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl border border-brand-ink/5 p-4 text-center"
                >
                  <Icon className="size-4 text-brand-pink mx-auto" aria-hidden="true" />
                  <p className="text-2xl font-extrabold text-brand-purple-900 mt-1">
                    {value}
                  </p>
                  <p className="text-xs text-brand-ink-muted">{label}</p>
                </div>
              ))}
            </section>

            {/* Private line — never part of the share surface */}
            {recap.weight_delta_kg !== null && (
              <section
                aria-label="سطر خاص"
                className="bg-brand-lavender/20 rounded-2xl p-4 flex items-start gap-3"
              >
                <Lock className="size-4 text-brand-purple-900 mt-1 shrink-0" aria-hidden="true" />
                <p className="text-sm text-brand-purple-900 leading-relaxed">
                  بينكِ وبين نفسك: وزنك تغيّر{" "}
                  <span className="font-bold" dir="ltr">
                    {AR_NUM.format(Math.abs(recap.weight_delta_kg))}
                  </span>{" "}
                  كجم هذا الأسبوع — هذا السطر لا يظهر عند المشاركة.
                </p>
              </section>
            )}

            <ShareWeekButton
              cookedDays={recap.cooked_days}
              guestDays={recap.guest_days}
            />
            <p className="text-xs text-brand-ink-muted text-center">
              تُشارك الأرقام العامة فقط — لا وزن ولا تفاصيل صحية.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
