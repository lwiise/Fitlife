import { UserRound } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { genderPick } from "@/lib/copy/gender";
import {
  getTrialDaysRemaining,
  type SubscriptionRow,
} from "@/lib/subscription/state";
import { TIER_DISPLAY_NAMES_AR, buildTrialEndsMessage } from "@/lib/subscription/strings";

// Gregorian calendar + Arabic month names + Arabic-Indic digits → "١٥ مايو ٢٠٢٦".
const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const CADENCE_AR: Record<string, string> = {
  monthly: "شهري",
  annual: "سنوي",
};

function planLine(sub: SubscriptionRow): string {
  const tier = TIER_DISPLAY_NAMES_AR[sub.tier];
  if (sub.status === "trialing") {
    const days = getTrialDaysRemaining(sub);
    return days > 0 ? `تجربة مجانية — ${buildTrialEndsMessage(days)}` : "تجربة مجانية — منتهية";
  }
  const cadence = sub.cadence ? CADENCE_AR[sub.cadence] : null;
  return cadence ? `خطة ${tier} — ${cadence}` : `خطة ${tier}`;
}

function statusBadge(status: SubscriptionRow["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "active":
      return { label: "نشط", className: "bg-success-soft text-success" };
    case "trialing":
      return { label: "فترة تجريبية", className: "bg-brand-tint text-brand-purple-900" };
    case "past_due":
      return { label: "تأخر السداد", className: "bg-critical-soft text-critical" };
    case "cancelled":
      return { label: "مُلغى", className: "bg-brand-tint text-brand-ink-muted" };
    default:
      return { label: "منتهي", className: "bg-brand-tint text-brand-ink-muted" };
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-brand-line py-3 last:border-0">
      <span className="shrink-0 text-[15px] text-brand-ink-muted">{label}</span>
      <span className="min-w-0 break-words text-end text-[15px] font-bold text-brand-ink">{children}</span>
    </div>
  );
}

export function AccountInfoCard({
  email,
  signupDate,
  subscription,
  ownerSex,
}: {
  email: string;
  signupDate: string;
  subscription: SubscriptionRow | null;
  ownerSex?: string | null;
}) {
  const g = genderPick(ownerSex);
  const badge = subscription ? statusBadge(subscription.status) : null;

  return (
    <Card aria-labelledby="account-info-title">
      <CardHeader
        id="account-info-title"
        title="معلومات الحساب"
        icon={<UserRound className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      <div>
        <Row label="البريد الإلكتروني">
          <span dir="ltr" className="tabular-nums">
            {email}
          </span>
        </Row>
        <Row label={g("عضوة منذ", "عضو منذ")}>{DATE_FMT.format(new Date(signupDate))}</Row>
        {subscription ? (
          <>
            <Row label="الاشتراك">{planLine(subscription)}</Row>
            <Row label="الحالة">
              {badge && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold ${badge.className}`}
                >
                  {badge.label}
                </span>
              )}
            </Row>
          </>
        ) : (
          <Row label="الاشتراك">لا يوجد اشتراك نشط</Row>
        )}
      </div>
    </Card>
  );
}
