import { ExternalLink } from "lucide-react";
import { getLSSubscriptionInvoices } from "@/lib/lemonsqueezy/subscription";

const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function fmtDate(iso: string): string {
  try {
    return DATE_FMT.format(new Date(iso));
  } catch {
    return iso;
  }
}

const INVOICE_STATUS: Record<string, { label: string; classes: string }> = {
  paid: { label: "مدفوعة", classes: "bg-success-soft text-success" },
  pending: { label: "قيد المعالجة", classes: "bg-warning-soft text-brand-ink" },
  refunded: { label: "مُستردة", classes: "bg-brand-tint text-brand-ink-muted" },
  failed: { label: "فشلت", classes: "bg-critical-soft text-critical" },
};

export async function BillingHistory({ subId }: { subId: string }) {
  const invoices = await getLSSubscriptionInvoices(subId);

  if (invoices.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-brand-ink-muted">
        لا توجد فواتير سابقة بعد.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-brand-line">
      {invoices.map((inv) => {
        const status =
          INVOICE_STATUS[inv.status] ?? {
            label: inv.status,
            classes: "bg-brand-tint text-brand-ink-muted",
          };
        return (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-bold tabular-nums text-brand-ink">
                {inv.total_formatted}
              </p>
              <p className="mt-0.5 text-meta tabular-nums text-brand-ink-muted">
                {fmtDate(inv.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${status.classes}`}
              >
                {status.label}
              </span>
              {inv.invoice_url && (
                <a
                  href={inv.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] font-bold text-brand-purple-900 hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900"
                >
                  عرض الفاتورة
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(تفتح في نافذة جديدة)</span>
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
