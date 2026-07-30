# @fitlife/landing — «باقة التحوّل الشاملة»

Standalone, single-page Arabic (RTL) sales landing page for the Fit Life
women's fitness bundle offer. Deliberately **not connected** to the Fit Life
app or website: no shared runtime code, no auth, no analytics — every CTA
goes to the Salla checkout URL, and the invoice flow goes to WhatsApp.

## Run locally

```bash
pnpm install            # from the repo root (pnpm workspace)
pnpm dev:landing        # → http://localhost:3002
```

Or from this directory: `pnpm dev`. Production check: `pnpm build && pnpm start`.

Quality gates: `pnpm type-check`, `pnpm lint`, `pnpm test` (all also run
repo-wide via turbo in CI, plus a dedicated `pnpm build:landing` CI step).

## Deploy (Vercel)

No config files needed. In the Vercel dashboard: **New Project → import the
repo → set Root Directory to `apps/landing`** — the pnpm workspace and
Next.js are auto-detected. Set the `NEXT_PUBLIC_SITE_URL` environment
variable to the production URL so OG/canonical metadata resolve correctly.

## Checkout

Purchases go through **Salla's fast-checkout widget** (store `1502078372`,
product `1893963313`, configured in `src/lib/config.ts`). It opens Salla's
hosted payment modal over the page — Apple Pay, mada, Visa/MasterCard, Tabby
and Tamara — so the shopper never leaves the offer.

The widget is a third-party custom element, and a custom element whose script
fails to load renders *nothing*. So each purchase point ships a fallback
button in the same slot, and CSS (`.salla-slot`, `:not(:defined)`) shows it
exactly when the widget can't render — the buy button can never be dead.
The fallback currently opens WhatsApp; set `SALLA.productUrl` to the store's
product page and it becomes a direct checkout link instead.

## Replace before launch (checklist)

- [ ] **Production domain** — set `NEXT_PUBLIC_SITE_URL` env var (or edit the
      `metadataBase` fallback in `src/app/layout.tsx`).
- [ ] *(optional)* **`SALLA.productUrl`** in `src/lib/config.ts` — upgrades the
      no-JS fallback from a WhatsApp hand-off to a real checkout link.
- [ ] **Logo** — the header renders a text mark (`Header.tsx`) and the favicon
      is a placeholder (`src/app/icon.svg`); swap in the real assets.
- [ ] **Social links** — the three footer icons point at `#`
      (`src/components/sections/Footer.tsx`); set the real profile URLs or
      remove the ones you don't use.
- [ ] **OG image** — add a designed `src/app/opengraph-image.png` (1200×630)
      so WhatsApp/Twitter shares show a card instead of plain text.
- [ ] **WhatsApp number/message** — confirm `whatsappNumber` and
      `whatsappMessage` in `src/lib/config.ts` (currently 966562272609).

## Structure

- `src/app/` — layout (Tajawal font, `lang="ar" dir="rtl"`, Arabic metadata/OG,
  `<RevealBootstrap />`) and the single `/` page composing the eight sections.
- `src/components/sections/` — Header, Hero, ValueStack, WhoFor, Steps, FAQ,
  FinalCTA, Footer. Copy is verbatim from the offer spec — don't rewrite it.
- `src/components/ui/` — shadcn-style primitives (button, card, badge,
  separator, accordion) + Magic-UI-style number-ticker and shimmer-button and
  the gold `section-eyebrow`, all RTL-ready with logical Tailwind classes only.
- `src/components/motion/Reveal.tsx` — the scroll-reveal system. `Reveal` is a
  server component that only stamps `data-reveal` + a stagger class;
  `RevealBootstrap` is the single inline script that arms it. Sections ship
  VISIBLE and are hidden only once the script confirms it can animate them, so
  no-JS (or a JS error) can never leave the page blank.
- `src/components/StickyBar.tsx` — mobile-only bottom bar, hidden while the
  hero CTA is in view.
- `src/components/FinalCTAPortrait.tsx` + `public/final-cta-woman.webp` — the
  closing section's photograph. It is FRAMED (rounded card, hairline ring, gold
  top edge) rather than dropped in loose: the photo's own backdrop is a warm
  plum a step lighter than this section's night field, so a bare rectangle
  reads as a mismatched patch. 4:5 matches the source exactly, and
  `src/lib/finalCtaPortrait.test.ts` fails if the two copies drift, if a
  re-crop breaks that ratio, or if someone commits the unoptimised original
  (the source PNG was 1.77 MB; the WebP is 57 KB).
- `src/styles/globals.css` — Tailwind v4 CSS-first tokens: Fit Life brand
  palette plus a two-shade offer gold (`gold-500` for numerals on purple and
  badge fills, `gold-700` for gold text on light surfaces — both AA), and the
  motion tokens (`--ease-settle` + `--dur-fast/base/slow` + `--reveal-stagger`)
  every transition on the page reads from.
- `src/lib/config.ts` — the one place prices, Salla store/product ids, and
  WhatsApp contact live.
