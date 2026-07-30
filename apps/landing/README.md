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

- `src/app/` — layout (Tajawal font, `lang="ar" dir="rtl"`, Arabic metadata/OG)
  and the single `/` page composing the eight sections.
- `src/components/sections/` — Header, Hero, ValueStack, WhoFor, Steps, FAQ,
  FinalCTA, Footer. Copy is verbatim from the offer spec — don't rewrite it.
- `src/components/ui/` — shadcn-style primitives (button, card, badge,
  separator, accordion) + Magic-UI-style number-ticker and shimmer-button,
  all RTL-ready with logical Tailwind classes only.
- `src/components/StickyBar.tsx` — mobile-only bottom bar, hidden while the
  hero CTA is in view.
- `src/styles/globals.css` — Tailwind v4 CSS-first tokens: Fit Life brand
  palette plus a two-shade offer gold (`gold-500` for numerals on purple and
  badge fills, `gold-700` for gold text on light surfaces — both AA).
- `src/lib/config.ts` — the one place prices, Salla store/product ids, and
  WhatsApp contact live.
