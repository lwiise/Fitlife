import { Fragment, type ReactElement, type ReactNode } from "react";
import { clsx } from "clsx";

/*
 * Separators and counts. The console never puts a «·» between inline items:
 * beside an Arabic-Indic digit a middle dot reads as the digit zero «٠» —
 * «كل العائلات · ١٤» read as 140, «١٤ عائلة · ٧ مدفوعة» as «٧٠ مدفوعة».
 * Between items there is one mark, <Sep/>; a count keeps its label company
 * through <Count/>, with no mark at all. Text that cannot hold an element (an
 * aria-label, a title, an <option>) joins with listSep() from
 * lib/admin/separators.ts instead.
 */

/**
 * The one visible separator between inline items: a thin vertical rule
 * (`.ad-sep` in admin.css), the same in both languages. Decorative — the
 * items around it carry the words.
 */
export function Sep() {
  return <span className="ad-sep" aria-hidden="true" />;
}

/** One item of a separated run: an element or a text; an empty one is skipped. */
export type SepItem = ReactElement | string | number | null | undefined | false;

/**
 * Inline items with a <Sep/> between each pair — a meta line, a table cell,
 * a legend: `joinSep(a, b, c)`, or `joinSep(...parts)` for a list. Empty
 * items (null, undefined, false, "") are dropped, so an optional part is just
 * `cond ? x : null`. A plain space stays on each side of the rule: it is
 * where the line may wrap, and what keeps two items two words for a screen
 * reader (a flex row's gap replaces it on screen; admin.css drops the rule's
 * own margin there). Keys follow each item's position among the arguments, so
 * an item keeps its identity when an optional one before it comes and goes.
 * (An item is never itself a list: `joinSep(list)` would not type-check, so a
 * forgotten spread cannot render a run without its separators.)
 */
export function joinSep(...items: SepItem[]): ReactNode[] {
  const out: ReactNode[] = [];
  items.forEach((item, i) => {
    if (item == null || item === false || item === "") return;
    out.push(
      <Fragment key={i}>
        {out.length > 0 ? (
          <>
            {" "}
            <Sep />{" "}
          </>
        ) : null}
        {item}
      </Fragment>,
    );
  });
  return out;
}

/**
 * A count attached to a label — «كل العائلات ١٤», «الأعمدة ١١», «مشتركة بين
 * ٣»: the number in its own element (`.ad-count`), after a plain space, with
 * no separator. In a flex row (chips, buttons, pills) the row's gap spaces it.
 */
export function Count({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <>
      {" "}
      <span className={clsx("ad-count", className)}>{children}</span>
    </>
  );
}
