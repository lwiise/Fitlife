import { LifeBuoy, Mail, MessageCircle, ChevronLeft } from "lucide-react";
import { env } from "@/lib/env";
import { genderPick } from "@/lib/copy/gender";
import { Card, CardHeader } from "@/components/ui/card";

function ContactRow({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string;
  icon: typeof Mail;
}) {
  return (
    <a
      href={href}
      className="group -mx-2 flex min-h-12 items-center justify-between gap-3 rounded-xl border-b border-brand-line px-2 py-3 last:border-0 hover:bg-brand-tint/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple-900"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-5 text-brand-purple-900" aria-hidden="true" />
        <span className="text-base font-bold text-brand-ink group-hover:text-brand-purple-900">
          {label}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-meta text-brand-ink-muted">
        <span dir="ltr" className="truncate tabular-nums">
          {value}
        </span>
        <ChevronLeft className="size-5 shrink-0 group-hover:text-brand-purple-900" aria-hidden="true" />
      </span>
    </a>
  );
}

export function SupportSection({ ownerSex }: { ownerSex?: string | null }) {
  const g = genderPick(ownerSex);
  const email = env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const whatsapp = env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const hasContact = Boolean(email || whatsapp);

  return (
    <Card aria-labelledby="support-section-title">
      <CardHeader
        id="support-section-title"
        title={g("تواصلي معنا", "تواصل معنا")}
        icon={<LifeBuoy className="size-5 text-brand-purple-900" aria-hidden="true" />}
      />

      {hasContact ? (
        <div>
          {email && (
            <ContactRow
              href={`mailto:${email}`}
              label="البريد الإلكتروني"
              value={email}
              icon={Mail}
            />
          )}
          {whatsapp && (
            <ContactRow
              href={`https://wa.me/${whatsapp}`}
              label="واتساب"
              value={whatsapp}
              icon={MessageCircle}
            />
          )}
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-brand-ink-muted">
          فريق الدعم متواجد لمساعدتك، وستظهر تفاصيل التواصل هنا قريباً.
        </p>
      )}
    </Card>
  );
}
