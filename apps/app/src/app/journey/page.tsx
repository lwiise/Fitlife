import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import { WeighInForm } from "./WeighInForm";

export const metadata = {
  title: "رحلتك الخاصة — فت لايف",
  robots: { index: false, follow: false },
};

const AR_NUM = new Intl.NumberFormat("ar-SA", {
  useGrouping: false,
  maximumFractionDigits: 1,
});

interface BodyLogPoint {
  recorded_on: string;
  weight_kg: number | null;
}

/** Server-rendered sparkline: weight series + optional target line. */
function Sparkline({
  points,
  targetKg,
}: {
  points: Array<{ recorded_on: string; weight_kg: number }>;
  targetKg: number | null;
}) {
  const W = 280;
  const H = 96;
  const PAD = 10;
  const values = points.map((p) => p.weight_kg);
  const all = targetKg !== null ? [...values, targetKg] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v: number) => PAD + ((max - v) * (H - PAD * 2)) / span;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.weight_kg).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1]!;

  return (
    <div dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24"
        role="img"
        aria-label="مسار وزنك عبر الأسابيع"
      >
        {targetKg !== null && (
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(targetKg)}
            y2={y(targetKg)}
            stroke="var(--color-brand-yellow)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
        <path
          d={path}
          fill="none"
          stroke="var(--color-brand-purple-900)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.weight_kg)}
          r="4"
          fill="var(--color-brand-purple-900)"
        />
      </svg>
    </div>
  );
}

export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("target_weight_kg, is_pregnant, weight_kg")
    .eq("id", user.id)
    .single();
  const targetKg = profile?.is_pregnant ? null : (profile?.target_weight_kg ?? null);

  // 00017 table — untyped pending db:types regen; empty pre-apply.
  const db = supabase as unknown as SupabaseClient;
  const { data: logRows } = await db
    .from("body_logs")
    .select("recorded_on,weight_kg")
    .eq("user_id", user.id)
    .eq("member_id", "mom")
    .order("recorded_on", { ascending: true })
    .limit(26);
  const logs = ((logRows ?? []) as BodyLogPoint[]).filter(
    (p): p is { recorded_on: string; weight_kg: number } =>
      typeof p.weight_kg === "number",
  );

  const latest = logs[logs.length - 1] ?? null;
  const previous = logs.length >= 2 ? logs[logs.length - 2]! : null;
  const delta =
    latest && previous
      ? Number((latest.weight_kg - previous.weight_kg).toFixed(1))
      : null;
  const remaining =
    latest && targetKg !== null
      ? Number((latest.weight_kg - targetKg).toFixed(1))
      : null;

  return (
    <main dir="rtl" className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <Logo />
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app max-w-2xl py-8 space-y-6">
        <h1 className="text-3xl font-extrabold text-brand-ink">رحلتك الخاصة</h1>

        <section
          aria-label="خصوصية"
          className="bg-brand-lavender/20 rounded-2xl p-4 flex items-start gap-3"
        >
          <Lock className="size-4 text-brand-purple-900 mt-1 shrink-0" aria-hidden="true" />
          <p className="text-sm text-brand-purple-900 leading-relaxed">
            هذه الصفحة لكِ وحدك — لا تظهر في الرسائل ولا بطاقات المشاركة ولا أي
            شاشة مشتركة.
          </p>
        </section>

        <WeighInForm
          lastWeightKg={latest?.weight_kg ?? profile?.weight_kg ?? null}
        />

        {logs.length >= 2 && (
          <section
            aria-label="مسار وزنك"
            className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-3"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-brand-ink">مسارك</h2>
              {delta !== null && (
                <p className="text-sm font-bold text-brand-purple-900">
                  {delta === 0
                    ? "ثبات هذا الأسبوع"
                    : delta < 0
                      ? `−${AR_NUM.format(Math.abs(delta))} كجم منذ آخر تسجيل`
                      : `+${AR_NUM.format(delta)} كجم منذ آخر تسجيل`}
                </p>
              )}
            </div>
            <Sparkline points={logs} targetKg={targetKg} />
            {remaining !== null && remaining > 0 && (
              <p className="text-xs text-brand-ink-muted">
                بقي {AR_NUM.format(remaining)} كجم نحو هدفك — الخط الذهبي.
              </p>
            )}
          </section>
        )}

        {logs.length < 2 && (
          <p className="text-sm text-brand-ink-muted leading-relaxed">
            بعد تسجيلين أسبوعيين يظهر مسارك هنا — تسجيل واحد في الأسبوع يكفي
            تماماً.
          </p>
        )}
      </div>
    </main>
  );
}
