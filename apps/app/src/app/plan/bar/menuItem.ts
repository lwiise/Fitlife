// Row style for the plan's sheets (the ••• «المزيد» sheet, the member sheet's
// footer links, the regenerate and PDF triggers when rendered as rows). Rows
// are 52px — a bottom sheet is thumb-driven, and the old dropdown's 44px rows
// read as cramped once they stretched to the full phone width. No
// whitespace-nowrap: a sheet row may wrap, a dropdown could not.
export const PLAN_MENU_ITEM_CLASS =
  "flex w-full items-center gap-3 min-h-[3.25rem] px-3 rounded-2xl text-[15px] font-bold text-brand-ink text-start hover:bg-brand-surface transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-900";

/** The leading icon of a {@link PLAN_MENU_ITEM_CLASS} row. */
export const PLAN_MENU_ICON_CLASS = "size-5 shrink-0 text-brand-purple-900";
