"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search, X } from "lucide-react";
import { genderPick } from "@/lib/copy/gender";

// -u-ca-gregory like every other date in the app: bare "ar-SA" resolves to the
// Umm al-Qura calendar on some ICU builds, so the same photo could read
// «٢٥ يوليو» on one phone and «١١ صفر» on another.
const AR_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "short",
});
const AR_LONG_DATE = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  day: "numeric",
  month: "long",
});
const AR_NUM = new Intl.NumberFormat("ar-SA", { useGrouping: false });

export interface JourneyPhoto {
  recorded_on: string;
  url: string;
}

const shortDate = (d: string) => AR_DATE.format(new Date(`${d}T00:00:00`));
const longDate = (d: string) => AR_LONG_DATE.format(new Date(`${d}T00:00:00`));

/** Arabic counts inflect: صورة / صورتان / ٣ صور / ١١ صورة. */
function photoCount(n: number): string {
  if (n === 1) return "صورة واحدة";
  if (n === 2) return "صورتان";
  if (n <= 10) return `${AR_NUM.format(n)} صور`;
  return `${AR_NUM.format(n)} صورة`;
}

/**
 * Progress photos, MASKED by default — the same deliberate-reveal stance as
 * the last-weight chip: this phone gets handed to children and the
 * housekeeper, so photos never render until an explicit tap, and collapse
 * again on a second tap.
 *
 * Plain <img> on purpose: the URLs are short-lived SIGNED links into the
 * private bucket — routing them through the next/image optimizer would copy
 * private photos into the optimizer's shared cache.
 */
export function PhotoStrip({
  photos,
  ownerSex,
}: {
  photos: JourneyPhoto[];
  ownerSex?: string | null;
}) {
  const [revealed, setRevealed] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const g = genderPick(ownerSex);

  // Hiding the strip closes the viewer with it — one tap always takes the
  // photos off the screen, whatever is open on top.
  const hide = () => {
    setOpenIndex(null);
    setRevealed(false);
  };

  return (
    <section
      aria-label="صور المسار"
      className="bg-white rounded-2xl border border-brand-ink/5 p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-brand-ink">صور المسار</h2>
          <p className="text-xs text-brand-ink-muted mt-0.5">
            {revealed
              ? g("اضغطي الصورة لعرضها كاملة", "اضغط الصورة لعرضها كاملة")
              : photoCount(photos.length)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (revealed ? hide() : setRevealed(true))}
          aria-pressed={revealed}
          className="inline-flex shrink-0 items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-bold text-brand-purple-900 hover:bg-brand-lavender/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
        >
          {revealed ? (
            <>
              <EyeOff className="size-4" aria-hidden="true" />
              إخفاء
            </>
          ) : (
            <>
              <Eye className="size-4" aria-hidden="true" />
              عرض الصور
            </>
          )}
        </button>
      </div>

      {revealed ? (
        <ul className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <li
              key={p.url}
              className="basis-[calc((100%-1.5rem)/3)] sm:basis-[calc((100%-2.25rem)/4)] max-w-40"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={`عرض صورة ${longDate(p.recorded_on)} بالحجم الكامل`}
                className="group block w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900 focus-visible:ring-offset-2"
              >
                <span className="relative block overflow-hidden rounded-xl border border-brand-ink/10 bg-brand-surface transition-shadow duration-200 group-hover:shadow-lg group-hover:shadow-brand-ink/10">
                  <img
                    src={p.url}
                    alt={`صورة المتابعة بتاريخ ${longDate(p.recorded_on)}`}
                    width={160}
                    height={213}
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-[3/4] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 start-1.5 inline-flex size-7 items-center justify-center rounded-full bg-brand-ink/55 text-white transition-colors duration-200 group-hover:bg-brand-purple-900"
                  >
                    <Search className="size-3.5" />
                  </span>
                </span>
                <span className="mt-1.5 block text-xs text-brand-ink-muted text-center">
                  {shortDate(p.recorded_on)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-brand-ink-muted leading-relaxed">
          الصور مخفية — تظهر بلمسة منك فقط.
        </p>
      )}

      {openIndex !== null && photos[openIndex] && (
        <PhotoViewer
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </section>
  );
}

/**
 * Full-bleed viewer for one progress photo — object-contain on ink so a tall
 * phone-shaped photo is seen whole (the grid crops to keep its rhythm; here
 * nothing is cut). Same dialog manners as ConfirmDialog: portal, ESC, backdrop
 * dismiss, scroll lock, reduced-motion aware. Arrows/swipe move through the
 * set in READING order — in RTL the next photo sits to the left.
 */
function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: JourneyPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const photo = photos[index]!;
  const many = photos.length > 1;

  const go = useCallback(
    (delta: number) => {
      if (!many) return;
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, many, onIndexChange, photos.length],
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag to gate createPortal (SSR-safe); runs once
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [mounted]);

  // On document, not on the dialog: tapping the photo itself leaves focus on
  // the body, and ESC has to keep working from there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // RTL: the next photo is the one to the LEFT.
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  /** Tab only — the viewer covers the page, so focus stays inside it. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const items = dialogRef.current?.querySelectorAll<HTMLElement>("button");
    if (!items || items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  const navButton =
    "inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink";

  return createPortal(
    <motion.div
      dir="rtl"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`صورة المتابعة بتاريخ ${longDate(photo.recorded_on)}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      /* Opaque, never a translucent scrim: a private photo should not be shown
         with the rest of the page ghosting through behind it. */
      className="fixed inset-0 z-50 flex flex-col bg-brand-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <p
          aria-live="polite"
          className="text-sm font-bold text-white/90 truncate"
        >
          {longDate(photo.recorded_on)}
          {many && (
            <span className="text-white/50 font-normal">
              {" — "}
              {AR_NUM.format(index + 1)} من {AR_NUM.format(photos.length)}
            </span>
          )}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="إغلاق الصورة"
          className={navButton}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* Backdrop dismiss: taps that land beside the photo close the viewer. */}
      <div
        className="relative flex-1 flex items-center justify-center px-4 pb-2 min-h-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={photo.url}
            src={photo.url}
            alt={`صورة المتابعة بتاريخ ${longDate(photo.recorded_on)}`}
            decoding="async"
            draggable={false}
            drag={many ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            className="max-h-full max-w-full w-auto object-contain rounded-2xl shadow-2xl touch-pan-y"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </AnimatePresence>
      </div>

      {many && (
        <div className="flex items-center justify-center gap-3 p-4 pt-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="الصورة السابقة"
            className={navButton}
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="الصورة التالية"
            className={navButton}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
