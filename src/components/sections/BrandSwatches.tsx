// TEMPORARY — design-system verification grid. Delete after sign-off.

type Swatch = {
  name: string;
  className: string;
  textOn?: "ink" | "white" | "ink-muted";
  note?: string;
};

const purpleScale: Swatch[] = [
  { name: "purple-50", className: "bg-brand-purple-50" },
  { name: "purple-100", className: "bg-brand-purple-100" },
  { name: "purple-200", className: "bg-brand-purple-200" },
  { name: "purple-300", className: "bg-brand-purple-300" },
  { name: "purple-400", className: "bg-brand-purple-400", textOn: "white" },
  { name: "purple-500", className: "bg-brand-purple-500", textOn: "white" },
  {
    name: "purple-600",
    className: "bg-brand-purple-600",
    textOn: "white",
    note: "#4E2490 · primary",
  },
  { name: "purple-700", className: "bg-brand-purple-700", textOn: "white" },
  { name: "purple-800", className: "bg-brand-purple-800", textOn: "white" },
  { name: "purple-900", className: "bg-brand-purple-900", textOn: "white" },
  { name: "purple-950", className: "bg-brand-purple-950", textOn: "white" },
];

const accents: Swatch[] = [
  {
    name: "yellow",
    className: "bg-brand-yellow",
    note: "#F2BB16 · highlights only",
  },
  { name: "yellow-dark", className: "bg-brand-yellow-dark", note: "hover" },
  {
    name: "pink",
    className: "bg-brand-pink",
    textOn: "white",
    note: "#C5458F · large heads only",
  },
  {
    name: "pink-dark",
    className: "bg-brand-pink-dark",
    textOn: "white",
    note: "hover",
  },
  {
    name: "lavender",
    className: "bg-brand-lavender",
    note: "#D9B0FC · bg only, never text",
  },
  { name: "lavender-soft", className: "bg-brand-lavender-soft", note: "fills" },
];

const neutrals: Swatch[] = [
  {
    name: "surface",
    className: "bg-surface",
    note: "#EBEFF2 · page bg (never pure white)",
  },
  {
    name: "surface-elevated",
    className: "bg-surface-elevated",
    note: "cards",
  },
  {
    name: "ink",
    className: "bg-ink",
    textOn: "white",
    note: "#1A1023 · body text",
  },
  {
    name: "ink-muted (72%)",
    className: "bg-[var(--ink-muted)]",
    textOn: "white",
    note: "secondary text",
  },
];

const shadcnTokens: Swatch[] = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground", textOn: "white" },
  { name: "card", className: "bg-card" },
  { name: "primary", className: "bg-primary", textOn: "white" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "accent", className: "bg-accent" },
  { name: "border", className: "bg-border" },
  { name: "ring", className: "bg-ring", textOn: "white" },
  {
    name: "destructive",
    className: "bg-destructive",
    textOn: "white",
  },
];

function SwatchTile({ swatch }: { swatch: Swatch }) {
  const textClass =
    swatch.textOn === "white"
      ? "text-white"
      : swatch.textOn === "ink-muted"
        ? "text-ink-muted"
        : "text-foreground";
  return (
    <div
      className={`${swatch.className} ${textClass} flex h-24 flex-col justify-between rounded-md border border-ink/10 p-3`}
      dir="ltr"
    >
      <span className="text-xs font-semibold tabular-nums">{swatch.name}</span>
      {swatch.note && (
        <span className="text-[10px] leading-tight opacity-80">
          {swatch.note}
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  swatches,
  cols = 6,
}: {
  title: string;
  swatches: Swatch[];
  cols?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3
        dir="ltr"
        className="text-h3 text-start font-display tracking-[0.05em] uppercase text-ink-muted"
      >
        {title}
      </h3>
      <div
        className={`grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-${cols}`}
      >
        {swatches.map((s) => (
          <SwatchTile key={s.name} swatch={s} />
        ))}
      </div>
    </div>
  );
}

export default function BrandSwatches() {
  return (
    <section
      aria-label="Brand swatch verification (temporary)"
      className="bg-surface bg-noise py-12"
    >
      <div className="container-page flex flex-col gap-10">
        <header dir="ltr" className="flex flex-col gap-2 text-start">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-pink">
            Temporary · Design-System Verification
          </span>
          <h2 className="text-h1 text-foreground">Fit Life 2.0 · Palette + tokens</h2>
          <p className="text-base text-ink-muted">
            OKLCH brand scale, shadcn semantic-token mapping, neutrals, and one
            type test. Delete <code>&lt;BrandSwatches /&gt;</code> from
            page.tsx after sign-off.
          </p>
        </header>

        <Section title="Purple Scale (50 → 950)" swatches={purpleScale} cols={6} />
        <Section title="Accents" swatches={accents} cols={6} />
        <Section title="Neutrals" swatches={neutrals} cols={4} />
        <Section title="shadcn Semantic Tokens" swatches={shadcnTokens} cols={5} />

        <div className="flex flex-col gap-2 border-t border-ink/10 pt-6">
          <h3
            dir="ltr"
            className="text-h3 text-start font-display tracking-[0.05em] uppercase text-ink-muted"
          >
            Type Specimens
          </h3>
          <p className="text-display text-foreground">
            خطة لكل فرد في البيت
          </p>
          <p className="text-h1 text-foreground">عنوان رئيسي · text-h1</p>
          <p className="text-h2 text-foreground">عنوان ثانوي · text-h2</p>
          <p className="text-h3 text-foreground">عنوان فرعي · text-h3</p>
          <p className="max-w-prose text-lg leading-[1.7] text-foreground">
            نص الجسم بحجم 18 بكسل وارتفاع سطر 1.7 — العربية تحتاج تباعدًا
            أطول من اللاتينية لراحة العين.
          </p>
          <p className="max-w-prose text-sm text-ink-muted">
            نص ثانوي · text-sm · ink-muted (72% — passes WCAG AA at 14px).
          </p>
        </div>
      </div>
    </section>
  );
}
