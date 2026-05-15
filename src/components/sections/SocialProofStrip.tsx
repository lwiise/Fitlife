import { Star } from "lucide-react";

interface SocialProofStripProps {
  userCount?: number;
  rating?: number;
  reviewCount?: number;
  pressLogos?: { name: string; logoSrc?: string }[];
}

const DEFAULT_LOGOS: { name: string; logoSrc?: string }[] = [
  { name: "Logo 1" },
  { name: "Logo 2" },
  { name: "Logo 3" },
];

const arabicNumber = new Intl.NumberFormat("ar-SA-u-nu-arab");

export default function SocialProofStrip({
  userCount = 547,
  rating = 4.8,
  reviewCount = 142,
  pressLogos = DEFAULT_LOGOS,
}: SocialProofStripProps) {
  return (
    <section
      aria-label="إحصائيات وإثبات اجتماعي"
      className="border-y border-ink/10 bg-surface-elevated py-8 md:py-12"
    >
      <div className="container-page grid grid-cols-1 gap-8 text-center md:grid-cols-3 md:gap-12">
        {/* COLUMN 1 — user count */}
        <div className="flex flex-col items-center justify-center gap-2">
          <span
            className="text-[48px] font-extrabold leading-none tabular-nums text-primary"
            dir="ltr"
          >
            +{arabicNumber.format(userCount)}
          </span>
          <span className="text-sm text-ink-muted">تسمية تجريبية للعدد</span>
        </div>

        {/* COLUMN 2 — rating */}
        <div className="relative flex flex-col items-center justify-center gap-2 md:before:absolute md:before:top-[20%] md:before:start-0 md:before:h-[60%] md:before:w-px md:before:bg-ink/10 md:before:content-['']">
          <div
            className="flex items-center gap-1"
            role="img"
            aria-label={`تقييم ${arabicNumber.format(rating)} من 5`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className="size-6 fill-brand-yellow text-brand-yellow"
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-sm text-ink-muted" dir="ltr">
            {arabicNumber.format(rating)} · {arabicNumber.format(reviewCount)} تقييم
          </span>
        </div>

        {/* COLUMN 3 — press logos */}
        <div className="relative flex flex-col items-center justify-center gap-3 md:before:absolute md:before:top-[20%] md:before:start-0 md:before:h-[60%] md:before:w-px md:before:bg-ink/10 md:before:content-['']">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            تسمية تجريبية للصحافة
          </span>
          <div className="flex items-center gap-6 opacity-30">
            {pressLogos.map((logo) => (
              <span
                key={logo.name}
                className="text-sm font-medium text-foreground"
                dir="ltr"
              >
                {logo.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
