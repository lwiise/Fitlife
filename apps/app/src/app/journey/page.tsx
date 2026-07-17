import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { BackToDashboard } from "@/components/BackToDashboard";
import {
  isWeighInEligibleMember,
  isWeighInEligibleMom,
} from "@/lib/engagement/eligibility";
import { BODY_PHOTOS_BUCKET } from "@/lib/engagement/types";
import { WeighInForm } from "./WeighInForm";
import { PhotoStrip } from "./PhotoStrip";

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
  photo_path?: string | null;
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
        aria-label="مسار الوزن عبر الأسابيع"
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

export default async function JourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ member: memberParam }, { data: profile }, { data: familyRows }] =
    await Promise.all([
      searchParams,
      supabase
        .from("profiles")
        .select("target_weight_kg, is_pregnant, weight_kg, birth_year")
        .eq("id", user.id)
        .single(),
      supabase
        .from("family_members")
        .select("id, name, member_type, role, birth_year, weight_kg")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true }),
    ]);

  // Every eligible adult gets their own journey; the shared rule decides who
  // that is (children never, the housekeeper never, under-18 never).
  const eligibleMembers = (familyRows ?? []).filter((m) =>
    isWeighInEligibleMember(m),
  );
  const momEligible = isWeighInEligibleMom(profile?.birth_year ?? null);

  const selectedMember =
    memberParam != null
      ? (eligibleMembers.find((m) => m.id === memberParam) ?? null)
      : null;
  // Unknown/ineligible ?member falls back to the mom's own journey.
  if (!selectedMember && !momEligible) redirect("/dashboard");
  const memberId = selectedMember?.id ?? "mom";
  const memberName = selectedMember?.name ?? null;

  // Target line: the mom's own target only — family adults carry no target
  // weight, and pregnancy gets no loss-framing at all.
  const targetKg =
    memberId === "mom" && !profile?.is_pregnant
      ? (profile?.target_weight_kg ?? null)
      : null;

  // select("*") on purpose: photo_path is a 00018 column — naming it here
  // would fail the whole read on a pre-apply prod, while * degrades to
  // rows-without-the-column (house tolerance pattern).
  const { data: logRows } = await supabase
    .from("body_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("member_id", memberId)
    .order("recorded_on", { ascending: true })
    .limit(26);
  const allRows = (logRows ?? []) as BodyLogPoint[];
  const logs = allRows.filter(
    (p): p is { recorded_on: string; weight_kg: number } =>
      typeof p.weight_kg === "number",
  );

  // Progress photos: newest-first, short-lived signed URLs (the bucket is
  // PRIVATE — plain paths are useless to a browser, by design). Tolerant of
  // pre-00018 prod where the column/bucket don't exist yet.
  const photoRows = allRows
    .filter((p): p is BodyLogPoint & { photo_path: string } => !!p.photo_path)
    .slice(-8)
    .reverse();
  let photos: Array<{ recorded_on: string; url: string }> = [];
  if (photoRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BODY_PHOTOS_BUCKET)
      .createSignedUrls(
        photoRows.map((p) => p.photo_path),
        60 * 60, // 1h — the page is private and re-signs on every load
      );
    if (signed) {
      photos = photoRows.flatMap((p, i) => {
        const url = signed[i]?.signedUrl;
        return url ? [{ recorded_on: p.recorded_on, url }] : [];
      });
    }
  }

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

  const lastKnownWeight =
    latest?.weight_kg ??
    (selectedMember
      ? ((selectedMember.weight_kg as number | null) ?? null)
      : (profile?.weight_kg ?? null));

  // The switcher renders only when there is someone to switch TO.
  const showSwitcher = (momEligible ? 1 : 0) + eligibleMembers.length >= 2;

  return (
    <main dir="rtl" className="min-h-screen bg-brand-surface">
      <header className="bg-white border-b border-brand-ink/5 sticky top-0 z-10">
        <div className="container-app py-4 flex items-center justify-between">
          <Logo />
          <BackToDashboard />
        </div>
      </header>

      <div className="container-app max-w-2xl py-8 space-y-6">
        <h1 className="text-3xl font-extrabold text-brand-ink">
          {memberName ? `رحلة ${memberName} الخاصة` : "رحلتك الخاصة"}
        </h1>

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

        {showSwitcher && (
          <nav aria-label="اختيار الفرد" className="flex flex-wrap gap-2">
            {momEligible && (
              <Link
                href="/journey"
                aria-current={memberId === "mom" ? "page" : undefined}
                className={`inline-flex items-center min-h-11 px-4 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                  memberId === "mom"
                    ? "bg-brand-purple-900 text-white"
                    : "border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30"
                }`}
              >
                أنتِ
              </Link>
            )}
            {eligibleMembers.map((m) => (
              <Link
                key={m.id}
                href={`/journey?member=${m.id}`}
                aria-current={memberId === m.id ? "page" : undefined}
                className={`inline-flex items-center min-h-11 px-4 rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface ${
                  memberId === m.id
                    ? "bg-brand-purple-900 text-white"
                    : "border border-brand-purple-900/20 text-brand-purple-900 hover:bg-brand-lavender/30"
                }`}
              >
                {m.name}
              </Link>
            ))}
          </nav>
        )}

        <WeighInForm
          memberId={memberId}
          memberName={memberName}
          userId={user.id}
          lastWeightKg={lastKnownWeight}
        />

        {logs.length >= 2 && (
          <section
            aria-label="مسار الوزن"
            className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-3"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-brand-ink">
                {memberName ? `مسار ${memberName}` : "مسارك"}
              </h2>
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

        {photos.length > 0 && <PhotoStrip photos={photos} />}

        {logs.length < 2 && (
          <p className="text-sm text-brand-ink-muted leading-relaxed">
            بعد تسجيلين أسبوعيين يظهر المسار هنا — تسجيل واحد في الأسبوع يكفي
            تماماً.
          </p>
        )}
      </div>
    </main>
  );
}
