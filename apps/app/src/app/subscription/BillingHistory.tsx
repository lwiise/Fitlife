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
  paid: { label: "مدفوعة", classes: "bg-brand-emerald/10 text-brand-emerald" },
  pending: { label: "قيد المعالجة", classes: "bg-brand-yellow/20 text-brand-ink" },
  refunded: { label: "مُستردة", classes: "bg-brand-ink/10 text-brand-ink-muted" },
  failed: { label: "فشلت", classes: "bg-red-100 text-red-700" },
};

export async function BillingHistory({ subId }: { subId: string }) {
  const invoices = await getLSSubscriptionInvoices(subId);

  if (invoices.length === 0) {
    return (
      <p className="text-brand-ink-muted text-sm leading-relaxed">
        ما فيه فواتير سابقة بعد
      </p>
    );
  }

  return (
    <ul className="divide-y divide-brand-ink/5">
      {invoices.map((inv) => {
        const status =
          INVOICE_STATUS[inv.status] ?? {
            label: inv.status,
            classes: "bg-brand-ink/10 text-brand-ink-muted",
          };
        return (
          <li
            key={inv.id}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="font-bold text-brand-ink text-sm tabular-nums">
                {inv.total_formatted}
              </p>
              <p className="text-brand-ink-muted text-xs tabular-nums mt-0.5">
                {fmtDate(inv.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${status.classes}`}
              >
                {status.label}
              </span>
              {inv.invoice_url && (
                <a
                  href={inv.invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-11 px-2 text-brand-purple-900 hover:text-brand-purple-700 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 rounded-md"
                >
                  عرض الفاتورة
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
