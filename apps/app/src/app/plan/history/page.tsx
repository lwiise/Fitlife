import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPlanHistory } from "@/lib/plans/getPlanHistory";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { SettingsLink } from "@/components/SettingsLink";
import { RestorePlanButton } from "./RestorePlanButton";
import { DeletePlanButton } from "./DeletePlanButton";
import { MemberHistorySelect } from "./MemberHistorySelect";

export const metadata = {
  title: "الخطط السابقة — فت لايف",
  robots: { index: false, follow: false },
};

const RANGE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
});
const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatWeekRange(weekStart: string | null): string {
  if (!weekStart) return "";
  try {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${RANGE_FMT.format(start)} — ${RANGE_FMT.format(end)}`;
  } catch {
    return weekStart;
  }
}

export default async function PlanHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const history = await getPlanHistory(user.id);

  // Per-member lens: the selectable members are the union across all plans
  // (the maid is never in plan_data, so never appears). "mom" first, then by
  // first appearance; use each member's most-recent name.
  const memberOrder: string[] = [];
  const memberNameById = new Map<string, string>();
  for (const item of history) {
    item.memberIds.forEach((id, i) => {
      if (!memberNameById.has(id)) {
        memberNameById.set(id, item.memberNames[i] ?? id);
        memberOrder.push(id);
      }
    });
  }
  memberOrder.sort((a, b) => (a === "mom" ? -1 : b === "mom" ? 1 : 0));
  const members = memberOrder.map((id) => ({
    id,
    name: memberNameById.get(id) ?? id,
  }));

  const selected =
    member && memberNameById.has(member) ? member : (members[0]?.id ?? "");
  const filtered = history.filter((item) => item.memberIds.includes(selected));

  return (
    <main className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <a
            href="/dashboard"
            aria-label="فت لايف — الرئيسية"
            className="inline-flex items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Logo className="h-9 w-auto" />
          </a>
          <div className="flex items-center gap-2">
            <BackToDashboard />
            <SettingsLink />
          </div>
        </div>
      </header>

      <div className="container-app py-8 md:py-12 max-w-2xl space-y-6">
        <header>
          <h1 className="font-extrabold text-3xl text-brand-ink leading-tight">
            الخطط السابقة
          </h1>
          <p className="mt-2 text-brand-ink-muted text-base leading-relaxed">
            اختاري الفرد وشوفي خططه السابقة، واستعيدي أي وحدة تبينها لهذا الأسبوع.
          </p>
        </header>

        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
            <p className="font-bold text-brand-ink">ما عندك خطط سابقة</p>
            <Link
              href="/plan"
              className="inline-flex items-center justify-center min-h-11 mt-4 px-5 rounded-full border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface"
            >
              الخطة الحالية
            </Link>
          </div>
        ) : (
          <>
            {members.length > 1 && (
              <MemberHistorySelect members={members} selected={selected} />
            )}

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-brand-ink/5 p-6 text-center">
                <p className="font-bold text-brand-ink">ما عنده خطط سابقة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item, idx) => {
                  const isCurrentForMember = idx === 0;
                  return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-brand-ink/5 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-full bg-brand-lavender/30 flex items-center justify-center flex-shrink-0">
                    <Calendar className="size-5 text-brand-purple-900" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-brand-ink tabular-nums">
                        {formatWeekRange(item.weekStartDate)}
                      </p>
                      {isCurrentForMember && (
                        <span className="inline-flex items-center rounded-full bg-brand-emerald/10 text-brand-emerald px-2.5 py-0.5 text-xs font-bold">
                          الحالية
                        </span>
                      )}
                    </div>
                    <p className="text-brand-ink-muted text-xs mt-1 leading-relaxed">
                      {item.memberCount} أفراد
                      {item.generatedAt
                        ? ` • أُنشئت ${DATE_FMT.format(new Date(item.generatedAt))}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4">
                  <Link
                    href={`/plan/history/${item.id}?member=${selected}`}
                    className="inline-flex items-center gap-1 min-h-11 px-4 text-brand-purple-900 hover:text-brand-purple-700 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
                  >
                    عرض
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </Link>
                  {!isCurrentForMember && <RestorePlanButton planId={item.id} />}
                  <DeletePlanButton planId={item.id} />
                </div>
              </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
