"use client";

import {
  useCallback,
  useEffect,
  useId,
  useOptimistic,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Columns3 } from "lucide-react";
import { clsx } from "clsx";
import { METRIC_POOL, type Granularity, type MetricKey, type RangePreset } from "@/lib/admin/timeseries";
import type { OvHead, RangeLabels } from "./model";
import { ownLink } from "./navWatch";
import { useOverviewNav } from "./OverviewScope";
import {
  METRIC_CAP,
  PRESETS,
  customPatch,
  expectedInterval,
  intervalsFor,
  clampYmd,
  isValidCustomRange,
  metricsPatch,
  paramOf,
  presetPatch,
  preservedFields,
  toggleMetric,
  withParams,
} from "./urls";

type Popover = "custom" | "metrics";
type Align = "start" | "end";

/** A popover's widest drawn size, for choosing the side it opens toward. */
const POP_WIDTH = 288;
const EDGE = 8;

/**
 * Which edge of the trigger a popover should align to so it stays on screen.
 * `end` keeps the popover's inline-end edge on the trigger's and grows toward
 * the inline start; `start` the reverse.
 */
function fitAlign(trigger: HTMLElement | null, preferred: Align): Align {
  if (!trigger) return preferred;
  const r = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const rtl = getComputedStyle(trigger).direction === "rtl";
  // Physical span the popover would take for each alignment.
  const growsLeftFromRight = (right: number) => right - POP_WIDTH >= EDGE;
  const growsRightFromLeft = (left: number) => left + POP_WIDTH <= vw - EDGE;
  const fits = (a: Align) =>
    (a === "end") !== rtl ? growsLeftFromRight(r.right) : growsRightFromLeft(r.left);
  if (fits(preferred)) return preferred;
  const other: Align = preferred === "end" ? "start" : "end";
  return fits(other) ? other : preferred;
}

/** Plain left clicks become client transitions; modified clicks open the link normally. */
function isPlainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return !(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
}

/** Close when focus moves to something outside the popover (Tab away). A
 * click that focuses nothing (Safari does not focus checkboxes) has no
 * related target and keeps it open. */
function closeOnFocusLeave(open: boolean, close: () => void) {
  return (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (open && next instanceof Node && !e.currentTarget.contains(next)) close();
  };
}

/**
 * Close a popover on Escape (focus returns to its trigger) and on a press
 * outside it (focus stays where the press put it).
 */
function useDismiss(
  open: boolean,
  wrapRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Leave an Escape meant for another layer (the ⌘K palette) alone.
      const focus = document.activeElement;
      if (focus && focus !== document.body && !wrapRef.current?.contains(focus)) return;
      close();
      triggerRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, wrapRef, triggerRef, close]);
}

/**
 * The overview's range row (prototype rangeRow): preset windows, a custom
 * range, the interval, and «تخصيص المؤشرات». Each change needs new server
 * data, so it is a client navigation inside the overview's transition — the
 * page stays on screen, dimmed and aria-busy, while the choice shows at once.
 * The presets and intervals are real links, so they also work before
 * hydration and open in a new tab with a modified click; they carry
 * `ownLink`, so the scope tells them from a navigation started elsewhere
 * (navWatch.ts).
 *
 * Every target is built from the scope's `query`, which already includes a
 * change still loading: «٩٠ يوم» then «شهر» asks for 90 days by month, and
 * «٧ أيام» then «٣٠ يوم» goes back to 30 days — never a URL that drops the
 * first choice or mistakes the second for a no-op.
 */
export function RangeControls({ head, labels }: { head: OvHead; labels: RangeLabels }) {
  const pathname = usePathname() ?? "/admin";
  const { navigate, query, metric } = useOverviewNav();
  const intervalParam = paramOf(query, "interval");

  const [preset, setPreset] = useOptimistic<RangePreset>(head.preset);
  const [interval, setOptInterval] = useOptimistic<Granularity>(head.interval);
  const [shown, setShown] = useOptimistic<MetricKey[]>(head.shown);
  const [open, setOpen] = useState<Popover | null>(null);
  const [align, setAlign] = useState<Record<Popover, Align>>({ custom: "end", metrics: "end" });
  const close = useCallback(() => setOpen(null), [setOpen]);

  const here = query ? `${pathname}?${query}` : pathname;

  /** `current`: the option already shown — a plain click on it does nothing. */
  function followLink(
    e: MouseEvent<HTMLAnchorElement>,
    href: string,
    current: boolean,
    optimistic: () => void,
  ) {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    if (current || href === here) return;
    navigate(href, optimistic);
  }

  function toggle(which: Popover, trigger: HTMLElement | null) {
    if (open === which) {
      setOpen(null);
      return;
    }
    setAlign((a) => ({ ...a, [which]: fitAlign(trigger, "end") }));
    setOpen(which);
  }

  return (
    <div className="ad-filters ad-ov-range">
      <div className="ad-seg ad-ov-presets" role="group" aria-label={labels.period}>
        {PRESETS.map((p) => {
          const href = withParams(pathname, query, presetPatch(p, intervalParam));
          return (
            <Link
              key={p}
              {...ownLink}
              href={href}
              prefetch={false}
              scroll={false}
              aria-current={preset === p ? "true" : undefined}
              onClick={(e) =>
                followLink(e, href, false, () => {
                  setPreset(p);
                  setOptInterval(expectedInterval(p, intervalParam));
                })
              }
            >
              {labels.presets[p]}
            </Link>
          );
        })}
      </div>

      <CustomRange
        head={head}
        labels={labels}
        active={preset === "custom"}
        open={open === "custom"}
        align={align.custom}
        pathname={pathname}
        query={query}
        onToggle={(trigger) => toggle("custom", trigger)}
        onClose={close}
        onApply={(from, to) => {
          setOpen(null);
          navigate(withParams(pathname, query, customPatch(from, to)), () => setPreset("custom"));
        }}
      />

      <div className="ad-seg" role="group" aria-label={labels.interval}>
        {intervalsFor(preset).map((g) => {
          const href = withParams(pathname, query, { interval: g });
          return (
            <Link
              key={g}
              {...ownLink}
              href={href}
              prefetch={false}
              scroll={false}
              aria-current={interval === g ? "true" : undefined}
              onClick={(e) => followLink(e, href, interval === g, () => setOptInterval(g))}
            >
              {labels.intervals[g]}
            </Link>
          );
        })}
      </div>

      <MetricsPicker
        labels={labels}
        shown={shown}
        open={open === "metrics"}
        align={align.metrics}
        onToggle={(trigger) => toggle("metrics", trigger)}
        onClose={close}
        onChange={(key) => {
          const result = toggleMetric(shown, key, metric);
          if (!result) return;
          navigate(withParams(pathname, query, metricsPatch(result)), () => setShown(result.shown));
        }}
      />
    </div>
  );
}

function CustomRange({
  head,
  labels,
  active,
  open,
  align,
  pathname,
  query,
  onToggle,
  onClose,
  onApply,
}: {
  head: OvHead;
  labels: RangeLabels;
  active: boolean;
  open: boolean;
  align: Align;
  pathname: string;
  query: string;
  onToggle: (trigger: HTMLElement | null) => void;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [from, setFrom] = useState(head.fromValue);
  const [to, setTo] = useState(head.toValue);
  const [invalid, setInvalid] = useState(false);
  useDismiss(open, wrapRef, triggerRef, onClose);

  useEffect(() => {
    if (open) fromRef.current?.focus();
  }, [open]);

  function openOrClose() {
    if (!open) {
      // Start from the range on screen each time the popover opens.
      setFrom(head.fromValue);
      setTo(head.toValue);
      setInvalid(false);
    }
    onToggle(triggerRef.current);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // A date past today (typed, not picked) means today; the server clamps
    // the end the same way.
    const start = clampYmd(from, head.maxDate);
    const end = clampYmd(to, head.maxDate);
    if (!isValidCustomRange(start, end)) {
      setInvalid(true);
      fromRef.current?.focus();
      return;
    }
    onApply(start, end);
    triggerRef.current?.focus();
  }

  return (
    <div className="ad-rel" ref={wrapRef} onBlur={closeOnFocusLeave(open, onClose)}>
      <button
        ref={triggerRef}
        type="button"
        className="ad-btn ad-btn-g ad-ov-custom"
        aria-expanded={open}
        aria-controls={open ? `${id}-pop` : undefined}
        aria-current={active ? "true" : undefined}
        onClick={openOrClose}
      >
        <Calendar className="ad-ic" aria-hidden="true" />
        {active && head.customText ? head.customText : labels.custom}
      </button>
      {open ? (
        <form
          id={`${id}-pop`}
          method="get"
          action={pathname}
          className={clsx("ad-pop ad-ov-datepop", align === "end" ? "ad-at-end" : "ad-at-start")}
          aria-label={labels.customTitle}
          // The console's own message instead of the browser's validation
          // bubble; min/max still shape the date pickers.
          noValidate
          onSubmit={submit}
        >
          {/* Without JavaScript this is a plain GET form that keeps the other parameters. */}
          {preservedFields(query, ["range", "from", "to", "page"]).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input type="hidden" name="range" value="custom" />
          <div className="ad-ov-field">
            <label htmlFor={`${id}-from`} className="ad-ov-flabel">
              {labels.from}
            </label>
            <input
              ref={fromRef}
              id={`${id}-from`}
              name="from"
              type="date"
              required
              className="ad-ov-date"
              value={from}
              max={to || head.maxDate}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${id}-err` : undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setInvalid(false);
              }}
            />
          </div>
          <div className="ad-ov-field">
            <label htmlFor={`${id}-to`} className="ad-ov-flabel">
              {labels.to}
            </label>
            <input
              id={`${id}-to`}
              name="to"
              type="date"
              required
              className="ad-ov-date"
              value={to}
              min={from || undefined}
              max={head.maxDate}
              aria-invalid={invalid || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setInvalid(false);
              }}
            />
          </div>
          {invalid ? (
            <p id={`${id}-err`} className="ad-ov-err" role="alert">
              {labels.invalid}
            </p>
          ) : null}
          <button type="submit" className="ad-btn ad-btn-p ad-lg">
            {labels.apply}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function MetricsPicker({
  labels,
  shown,
  open,
  align,
  onToggle,
  onClose,
  onChange,
}: {
  labels: RangeLabels;
  shown: MetricKey[];
  open: boolean;
  align: Align;
  onToggle: (trigger: HTMLElement | null) => void;
  onClose: () => void;
  onChange: (key: MetricKey) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useDismiss(open, wrapRef, triggerRef, onClose);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  const atCap = shown.length >= METRIC_CAP;
  const atMin = shown.length <= 1;
  const limit = atCap ? labels.customizeFull : atMin ? labels.customizeMin : "";

  return (
    <div className="ad-rel" ref={wrapRef} onBlur={closeOnFocusLeave(open, onClose)}>
      <button
        ref={triggerRef}
        type="button"
        className="ad-btn ad-btn-g"
        aria-expanded={open}
        aria-controls={open ? `${id}-pop` : undefined}
        onClick={() => onToggle(triggerRef.current)}
      >
        <Columns3 className="ad-ic" aria-hidden="true" />
        {labels.customize}
      </button>
      {open ? (
        <div
          id={`${id}-pop`}
          role="group"
          aria-label={labels.customize}
          aria-describedby={`${id}-cap`}
          className={clsx("ad-pop ad-ov-pop", align === "end" ? "ad-at-end" : "ad-at-start")}
        >
          <p id={`${id}-cap`} className="ad-ph">
            {labels.customizeCap}
          </p>
          {METRIC_POOL.map((key, i) => {
            const on = shown.includes(key);
            // Focusable and announced rather than `disabled`, so keyboard and
            // screen-reader users find out why the choice is refused.
            const blocked = on ? atMin : atCap;
            return (
              <label key={key}>
                <input
                  ref={i === 0 ? firstRef : undefined}
                  type="checkbox"
                  checked={on}
                  aria-disabled={blocked || undefined}
                  aria-describedby={blocked ? `${id}-limit` : undefined}
                  onChange={() => {
                    if (!blocked) onChange(key);
                  }}
                />
                {labels.metrics[key]}
              </label>
            );
          })}
          <p id={`${id}-limit`} className="ad-ph ad-ov-limit" aria-live="polite">
            {limit}
          </p>
        </div>
      ) : null}
    </div>
  );
}
