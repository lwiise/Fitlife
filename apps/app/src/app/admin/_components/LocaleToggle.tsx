import type { ReactNode } from "react";
import type { AdminLocale } from "@/lib/admin/format";
import { setAdminLocale } from "../actions";

/** Small inline flags (zero external deps, render identically on every OS —
 * unlike flag emoji, which Windows shows as plain letters). */
function FlagSaudi() {
  return (
    <svg
      viewBox="0 0 24 16"
      width={24}
      height={16}
      role="presentation"
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
    >
      <rect width="24" height="16" rx="2" fill="#006C35" />
      {/* shahada — stylised script, not literal text */}
      <path
        d="M5 6.1q1.2-1.7 2.4 0t2.4 0 2.4 0 2.4 0 2.4 0"
        fill="none"
        stroke="#fff"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <circle cx="8" cy="7.7" r="0.35" fill="#fff" />
      <circle cx="13" cy="7.7" r="0.35" fill="#fff" />
      {/* sword */}
      <g fill="#fff">
        <path d="M5 9.95v1.5L3.2 10.7Z" />
        <rect x="5" y="10.15" width="12.4" height="1.1" rx="0.55" />
        <rect x="17.3" y="9.5" width="0.9" height="2.4" rx="0.3" />
        <rect x="18.2" y="10.15" width="1.5" height="1.1" rx="0.4" />
        <circle cx="20.1" cy="10.7" r="0.7" />
      </g>
      <rect
        x="0.25"
        y="0.25"
        width="23.5"
        height="15.5"
        rx="1.85"
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

const US_STRIPE_H = 16 / 13;
const US_RED_ROWS = [0, 2, 4, 6, 8, 10, 12];
const US_STAR_COLS = [1.6, 3.6, 5.6, 7.6];
const US_STAR_ROWS = [1.7, 4.1, 6.5];

function FlagUSA() {
  return (
    <svg
      viewBox="0 0 24 16"
      width={24}
      height={16}
      role="presentation"
      aria-hidden="true"
      className="shrink-0 rounded-[2px]"
    >
      <defs>
        <clipPath id="us-flag-clip">
          <rect width="24" height="16" rx="2" />
        </clipPath>
      </defs>
      <g clipPath="url(#us-flag-clip)">
        <rect width="24" height="16" fill="#fff" />
        {US_RED_ROWS.map((row) => (
          <rect
            key={row}
            y={row * US_STRIPE_H}
            width="24"
            height={US_STRIPE_H}
            fill="#B22234"
          />
        ))}
        <rect width="9.6" height={7 * US_STRIPE_H} fill="#3C3B6E" />
        {US_STAR_ROWS.flatMap((cy) =>
          US_STAR_COLS.map((cx) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.42" fill="#fff" />
          )),
        )}
      </g>
      <rect
        x="0.25"
        y="0.25"
        width="23.5"
        height="15.5"
        rx="1.85"
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/** ar/en switch — a zero-JS form whose server action sets the cookie and
 * returns to `next`. Direction flips at the layout on the next render. */
export function LocaleToggle({
  locale,
  next,
}: {
  locale: AdminLocale;
  next: string;
}) {
  const options: Array<{
    value: AdminLocale;
    flag: ReactNode;
    name: string;
  }> = [
    { value: "ar", flag: <FlagSaudi />, name: "العربية" },
    { value: "en", flag: <FlagUSA />, name: "English" },
  ];
  return (
    <form
      action={setAdminLocale}
      aria-label={locale === "ar" ? "تبديل اللغة" : "Switch language"}
      className="inline-flex rounded-lg border border-brand-ink/15 p-0.5"
    >
      <input type="hidden" name="next" value={next} />
      {options.map((o) => {
        const active = o.value === locale;
        return (
          <button
            key={o.value}
            type="submit"
            name="locale"
            value={o.value}
            aria-pressed={active}
            aria-label={o.name}
            title={o.name}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 transition-colors ${
              active
                ? "bg-brand-purple-900"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            {o.flag}
          </button>
        );
      })}
    </form>
  );
}
