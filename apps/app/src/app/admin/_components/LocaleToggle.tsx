import type { AdminLocale } from "@/lib/admin/format";
import { setAdminLocale } from "../actions";

/** ar/en switch — a zero-JS form whose server action sets the cookie and
 * returns to `next`. Direction flips at the layout on the next render. */
export function LocaleToggle({
  locale,
  next,
}: {
  locale: AdminLocale;
  next: string;
}) {
  const options: Array<{ value: AdminLocale; label: string; name: string }> = [
    { value: "ar", label: "ع", name: "العربية" },
    { value: "en", label: "EN", name: "English" },
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
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-bold transition-colors ${
              active
                ? "bg-brand-purple-900 text-white"
                : "text-brand-ink-muted hover:text-brand-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </form>
  );
}
