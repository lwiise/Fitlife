import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { clsx } from "clsx";
import type { AdminLocale } from "@/lib/admin/format";
import { statusLabel, t } from "@/lib/admin/i18n";
import {
  fmtDay,
  planStateLabel,
  planStateTone,
  subscriptionStatusTone,
  tierName,
  toneClass,
  type Tone,
} from "./helpers";

/**
 * The small, shared pieces the family blocks are built from. Markup mirrors
 * the prototype's classes through the `ad-` naming rule; styling lives in
 * ../admin.css. No hooks — usable from server and client components.
 */

/** A rounded pill with a leading dot (`.ad-pill`); `plain` drops the dot. */
export function Pill({
  tone,
  plain,
  title,
  className,
  children,
}: {
  tone: Tone;
  plain?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={clsx("ad-pill", toneClass(tone), plain && "ad-plain", className)}
    >
      {children}
    </span>
  );
}

/** A square-cornered flag chip (`.ad-flag`). */
export function FlagChip({
  tone,
  title,
  children,
}: {
  tone: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={clsx("ad-flag", toneClass(tone))}>
      {children}
    </span>
  );
}

/**
 * The small warning flag that says "the newest run failed and an older one
 * is shown" — an icon for the eye, the sentence for assistive tech.
 */
export function MaskedMark({ locale }: { locale: AdminLocale }) {
  const text = t("fm_masked_short", locale);
  return (
    <span className="ad-flag ad-warn" title={text}>
      <TriangleAlert className="ad-ic" aria-hidden="true" />
      <span className="ad-sr">{text}</span>
    </span>
  );
}

/** An isolated left-to-right run (emails, ids, model names) that translators skip. */
export function Ltr({ mono, children }: { mono?: boolean; children: ReactNode }) {
  return (
    <span dir="ltr" translate="no" className={mono ? "ad-mono" : "ad-ltr"}>
      {children}
    </span>
  );
}

/** Arabic plan content (dish and session names) — RTL and tagged Arabic in any UI language. */
export function ArText({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span lang="ar" dir="rtl" className={clsx("ad-ar-text", className)}>
      {children}
    </span>
  );
}

/** One key–value pair inside a `<dl className="ad-kv">`. */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A calendar date in a `<time>` (fmtDay: fmtDate's shape, Gregorian pinned). "—" when missing. */
export function DateText({ iso, locale }: { iso: string | null | undefined; locale: AdminLocale }) {
  if (!iso) return <>—</>;
  return <time dateTime={iso}>{fmtDay(iso, locale)}</time>;
}

/** A plan state or raw plan status as a pill (ready / generating / failed / archived). */
export function PlanStatePill({ state, locale }: { state: string; locale: AdminLocale }) {
  return <Pill tone={planStateTone(state)}>{planStateLabel(state, locale)}</Pill>;
}

/** Subscription tier as a tag (`.ad-tier`); "—" when missing. */
export function TierTag({ tier, locale }: { tier: string | null; locale: AdminLocale }) {
  if (!tier) return <span className="ad-muted">—</span>;
  return <span className="ad-tier">{tierName(tier, locale)}</span>;
}

/** Subscription status as a toned pill; null reads «بدون اشتراك». */
export function SubscriptionStatusPill({
  status,
  locale,
}: {
  status: string | null;
  locale: AdminLocale;
}) {
  return <Pill tone={subscriptionStatusTone(status)}>{statusLabel(status, locale)}</Pill>;
}

/** Errors can run long (class histograms, traces); tables show the start. */
const ERROR_PREVIEW = 160;

/**
 * A run error: the first part inline, the whole text on hover (as the old
 * detail page did). Direction comes from the text itself — most errors are
 * English, some are Arabic sentences.
 */
export function ErrorText({ text }: { text: string }) {
  const short = text.length > ERROR_PREVIEW ? `${text.slice(0, ERROR_PREVIEW).trimEnd()}…` : text;
  return (
    <bdi translate="no" title={text}>
      {short}
    </bdi>
  );
}
